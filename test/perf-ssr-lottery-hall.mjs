#!/usr/bin/env node
/**
 * 量測 /lottery-hall 「頁面載入到彩池數字顯示為最終值」的時間，用來對比
 * SSR（useAsyncData）改造前後的差異（見 add-ssr-lottery-hall-pools）。
 *
 * 用法：
 *   node test/perf-ssr-lottery-hall.mjs            # SCENARIO 預設 unlabeled
 *   SCENARIO=before node test/perf-ssr-lottery-hall.mjs
 *   SCENARIO=after  node test/perf-ssr-lottery-hall.mjs
 *   RUNS=5 node test/perf-ssr-lottery-hall.mjs      # 預設 5 次取中位數
 *
 * 前提：dev server 要跑著（預設 http://localhost:6100）。
 *
 * 量測邏輯：鎖定第一張有彩池的卡片（`.gc__pool-val` 第一個符合的元素——用 class 不用
 * `[data-pool-value]`，因為那個屬性是這次改造才加上去的，SSR 改造前的版本沒有，用
 * class 選取才能在改造前後用同一支腳本量測），從 `page.goto()` 送出那一刻起算，
 * 持續輪詢它的文字內容，直到「連續 300ms 文字都沒變」才視為「動畫（如果有的話）
 * 已經跑完、數字已經是最終值」——SSR 版本因為數字從第一次渲染就是最終值、從未觸發
 * `_animatePoolTo`，這個穩定點幾乎等於頁面載入時間；CSR 版本要等 fetch 完成 + 4 秒
 * requestAnimationFrame 動畫跑完才會穩定，兩者應該會有數秒等級的明顯差距。
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
  const start = Date.now()
  await page.goto(`${BASE_URL}/lottery-hall`, { waitUntil: 'domcontentloaded' })

  let lastText = null
  let stableSince = null
  let settledAt = null

  while (Date.now() - start < TIMEOUT_MS) {
    // 短逾時（200ms）：改造前的版本要等 client-only 的 onMounted 跑完才會出現這個元素，
    // 不能用 Playwright 預設的長 actionability timeout 乾等，否則每一輪輪詢都卡住
    const text = await page.locator(SELECTOR).first().textContent({ timeout: 200 }).catch(() => null)
    const now = Date.now()
    if (text !== lastText) {
      lastText = text
      stableSince = now
    } else if (text != null && text.trim() !== '' && stableSince != null && now - stableSince >= STABLE_MS) {
      settledAt = stableSince
      break
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }

  await page.close()

  if (settledAt == null) {
    throw new Error(`逾時（${TIMEOUT_MS}ms）仍未偵測到 ${SELECTOR} 文字穩定下來`)
  }
  return settledAt - start
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

async function main() {
  const browser = await chromium.launch()
  const results = []
  for (let i = 0; i < RUNS; i += 1) {
    const ms = await measureOnce(browser)
    results.push(ms)
    console.log(`  第 ${i + 1} 次：${ms}ms`)
  }
  await browser.close()

  const result = {
    scenario: SCENARIO,
    runs: RUNS,
    samplesMs: results,
    medianMs: median(results)
  }
  console.log(`\n=== ${SCENARIO} ===`)
  console.log(JSON.stringify(result))
}

main().catch((err) => {
  console.error('量測腳本執行失敗：', err)
  process.exitCode = 1
})
