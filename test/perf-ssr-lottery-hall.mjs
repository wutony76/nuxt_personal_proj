#!/usr/bin/env node
/**
 * 量測 /lottery-hall 的多項效能指標，對比 SSR（useAsyncData）改造前後的差異
 * （見 add-ssr-lottery-hall-pools）。
 *
 * 用法：
 *   SCENARIO=before node test/perf-ssr-lottery-hall.mjs
 *   SCENARIO=after  node test/perf-ssr-lottery-hall.mjs
 *   RUNS=5 node test/perf-ssr-lottery-hall.mjs      # 預設 5 次取中位數
 *
 * 前提：dev server 要跑著（預設 http://localhost:6100）。
 *
 * ⚠️ 這支腳本第一版只量「畫面數字停止變動（settled）」的時間，被抓出來是誤導性指標——
 * 改造前的 settled 時間裡有 ~4000ms 是 `_animatePoolTo` 的 `POOL_ANIM_MS` 動畫時間，
 * 不是網路延遲或 CSR waterfall 本身的成本，拿「settled 時間差了幾倍」當 SSR 效益
 * 幾乎等於拿「拔掉動畫」的效果去邀功。這一版改成同時量 4 個指標，分別對應不同問題：
 *
 *   - TTFB：SSR 的代價——伺服器要等 15 個彩池 API 都回來才能送出 HTML，TTFB 一定會
 *     變慢，誠實列出來，不要只講好處不講代價。
 *   - firstRealNumberMs：第一次看到「非 0、非空」數字的時間，這才是真正代表
 *     CSR waterfall 成本的指標（還沒套用動畫的瞬間），拿來跟 TTFB 的增幅相減，
 *     才是「SSR 省下的 waterfall 時間」。
 *   - settledMs：數字真正停止變動（含動畫跑完）的時間，保留是因為它仍然代表
 *     「使用者看到最終正確數字」的真實體驗時間點，只是不能單獨拿來說是 SSR 的功勞。
 *   - lcpMs：Largest Contentful Paint（瀏覽器原生 PerformanceObserver，業界標準指標）。
 */

import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://localhost:6100'
const SCENARIO = process.env.SCENARIO || 'unlabeled'
const RUNS = Number(process.env.RUNS || 5)
const STABLE_MS = 300
const POLL_MS = 25
const TIMEOUT_MS = 15000
const SELECTOR = '.gc__pool-val'

async function measureOnce(browser) {
  const page = await browser.newPage()

  await page.addInitScript(() => {
    // @ts-ignore
    window.__lcp = null
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const last = entries[entries.length - 1]
        // @ts-ignore
        if (last) window.__lcp = last.renderTime || last.loadTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch { /* 瀏覽器不支援就略過，lcpMs 回 null */ }
  })

  const start = Date.now()
  await page.goto(`${BASE_URL}/lottery-hall`, { waitUntil: 'domcontentloaded' })

  const ttfbMs = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    return nav ? Math.round(nav.responseStart) : null
  })

  let lastText = null
  let stableSince = null
  let firstRealAt = null
  let settledAt = null

  while (Date.now() - start < TIMEOUT_MS) {
    const text = await page.locator(SELECTOR).first().textContent({ timeout: 200 }).catch(() => null)
    const now = Date.now()
    const isReal = text != null && text.trim() !== '' && text.trim() !== '0'

    if (isReal && firstRealAt == null) {
      firstRealAt = now - start
    }

    if (text !== lastText) {
      lastText = text
      stableSince = now
    } else if (isReal && stableSince != null && now - stableSince >= STABLE_MS) {
      settledAt = stableSince - start
      break
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }

  if (settledAt == null) {
    await page.close()
    throw new Error(`逾時（${TIMEOUT_MS}ms）仍未偵測到 ${SELECTOR} 文字穩定下來`)
  }

  // networkidle 讓 LCP 有機會穩定下來再讀
  await page.waitForLoadState('networkidle').catch(() => {})
  const lcpMs = await page.evaluate(() => {
    // @ts-ignore
    return window.__lcp != null ? Math.round(window.__lcp) : null
  })

  await page.close()
  return { ttfbMs, firstRealNumberMs: firstRealAt, settledMs: settledAt, lcpMs }
}

function median(values) {
  const sorted = [...values].filter((v) => v != null).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

async function main() {
  const browser = await chromium.launch()
  const samples = []
  for (let i = 0; i < RUNS; i += 1) {
    const m = await measureOnce(browser)
    samples.push(m)
    console.log(`  第 ${i + 1} 次：TTFB=${m.ttfbMs}ms, firstRealNumber=${m.firstRealNumberMs}ms, settled=${m.settledMs}ms, LCP=${m.lcpMs}ms`)
  }
  await browser.close()

  const result = {
    scenario: SCENARIO,
    runs: RUNS,
    samples,
    medians: {
      ttfbMs: median(samples.map((s) => s.ttfbMs)),
      firstRealNumberMs: median(samples.map((s) => s.firstRealNumberMs)),
      settledMs: median(samples.map((s) => s.settledMs)),
      lcpMs: median(samples.map((s) => s.lcpMs))
    }
  }
  console.log(`\n=== ${SCENARIO}（中位數）===`)
  console.log(JSON.stringify(result.medians))
  console.log('\n完整結果：')
  console.log(JSON.stringify(result))
}

main().catch((err) => {
  console.error('量測腳本執行失敗：', err)
  process.exitCode = 1
})
