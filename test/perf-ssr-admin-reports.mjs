#!/usr/bin/env node
/**
 * 量測 /admin/reports（已登入管理員）的多項效能指標，對比 SSR + cookie 轉發改造前後
 * 的差異（見 add-ssr-admin-reports-cookie-forward）。方法論與 perf-ssr-lottery-hall.mjs
 * 一致（同一次 code review 教訓：同時量 TTFB／首次真實數字／settled／LCP，不要只看
 * 單一容易被誤導的指標）。
 *
 * 用法：
 *   SCENARIO=before node test/perf-ssr-admin-reports.mjs
 *   SCENARIO=after  node test/perf-ssr-admin-reports.mjs
 *
 * 前提：dev server 要跑著（預設 http://localhost:6100），admin 種子帳號存在。
 */

import { chromium } from 'playwright'
import { encodePassword } from './_test-utils.mjs'

const BASE_URL = process.env.BASE_URL || 'http://localhost:6100'
const SCENARIO = process.env.SCENARIO || 'unlabeled'
const RUNS = Number(process.env.RUNS || 5)
const STABLE_MS = 300
const POLL_MS = 25
const TIMEOUT_MS = 15000
const SELECTOR = '.ard-kpi-num'

async function loginAndGetCookie() {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: encodePassword('123456', 'admin@example.com') })
  })
  const setCookie = res.headers.get('set-cookie')
  const [name, ...rest] = setCookie.split(';')[0].split('=')
  return { name, value: rest.join('=') }
}

async function measureOnce(browser, cookie) {
  const context = await browser.newContext()
  await context.addCookies([{ name: cookie.name, value: cookie.value, url: BASE_URL }])
  const page = await context.newPage()

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
    } catch { /* 瀏覽器不支援就略過 */ }
  })

  const start = Date.now()
  await page.goto(`${BASE_URL}/admin/reports`, { waitUntil: 'domcontentloaded' })

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
    const isReal = text != null && text.trim() !== ''

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
    await context.close()
    throw new Error(`逾時（${TIMEOUT_MS}ms）仍未偵測到 ${SELECTOR} 文字穩定下來`)
  }

  await page.waitForLoadState('networkidle').catch(() => {})
  const lcpMs = await page.evaluate(() => {
    // @ts-ignore
    return window.__lcp != null ? Math.round(window.__lcp) : null
  })

  await context.close()
  return { ttfbMs, firstRealNumberMs: firstRealAt, settledMs: settledAt, lcpMs }
}

function median(values) {
  const sorted = [...values].filter((v) => v != null).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

async function main() {
  const cookie = await loginAndGetCookie()
  const browser = await chromium.launch()
  const samples = []
  for (let i = 0; i < RUNS; i += 1) {
    const m = await measureOnce(browser, cookie)
    samples.push(m)
    console.log(`  第 ${i + 1} 次：TTFB=${m.ttfbMs}ms, firstRealNumber=${m.firstRealNumberMs}ms, settled=${m.settledMs}ms, LCP=${m.lcpMs}ms`)
  }
  await browser.close()

  const medians = {
    ttfbMs: median(samples.map((s) => s.ttfbMs)),
    firstRealNumberMs: median(samples.map((s) => s.firstRealNumberMs)),
    settledMs: median(samples.map((s) => s.settledMs)),
    lcpMs: median(samples.map((s) => s.lcpMs))
  }
  console.log(`\n=== ${SCENARIO}（中位數）===`)
  console.log(JSON.stringify(medians))
  console.log('\n完整結果：')
  console.log(JSON.stringify({ scenario: SCENARIO, runs: RUNS, samples, medians }))
}

main().catch((err) => {
  console.error('量測腳本執行失敗：', err)
  process.exitCode = 1
})
