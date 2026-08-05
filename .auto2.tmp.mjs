import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()) })

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type=email]', 'hfyy@cc.cc')
await page.fill('input[type=password]', '123456')
await page.click('button[type=button]:not([disabled])')
await page.waitForTimeout(1500)
await page.goto(`${BASE}/lottery/bg/6hc-cd/tema`, { waitUntil: 'networkidle' })
await page.waitForTimeout(3500)
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await page.waitForTimeout(600)

const setAuto = async (amount, count) => {
  const inputs = page.locator('.auto-warp .coin-input')
  await inputs.nth(0).fill(String(amount)); await inputs.nth(0).dispatchEvent('blur')
  await inputs.nth(1).fill(String(count)); await inputs.nth(1).dispatchEvent('blur')
  await page.waitForTimeout(300)
}
const probe = () => page.evaluate(() => ({
  status: document.querySelector('.auto-status')?.textContent?.replace(/\s+/g, ' ').trim(),
  type: [...(document.querySelector('.auto-status')?.classList ?? [])].filter((c) => c !== 'auto-status').join(','),
  on: document.querySelector('.auto-toggle')?.classList.contains('on'),
  issue: document.querySelector('.timer .issue')?.textContent?.replace(/\s+/g, ' ').trim(),
  orders: document.querySelectorAll('.report-issue-bets-table tbody tr:not(.tr-no-records)').length,
  count: document.querySelectorAll('.auto-warp .coin-input')[1]?.value,
}))

// 1) 餘額不足
await setAuto(99999, 49)
console.log('餘額不足設定 =', JSON.stringify(await probe()))
await page.click('.auto-warp .auto-toggle')
await page.waitForTimeout(2500)
console.log('餘額不足結果 =', JSON.stringify(await probe()))
await page.click('.auto-warp .auto-toggle')
await page.waitForTimeout(500)

// 2) 跨期自動投注
await setAuto(1, 2)
await page.click('.auto-warp .auto-toggle')
await page.waitForTimeout(3000)
const first = await probe()
console.log('本期投注 =', JSON.stringify(first))
const firstIssue = (first.status.match(/第(\d+)期/) || [])[1]

console.log('等待下一期開盤自動投注（最多 9 分鐘）…')
const deadline = Date.now() + 9 * 60 * 1000
const seen = new Set([firstIssue])
let crossed = null
while (Date.now() < deadline) {
  const p = await probe()
  const issue = (p.status.match(/第(\d+)期/) || [])[1]
  if (p.type === 'success' && issue && !seen.has(issue)) { crossed = { ...p, issue }; break }
  if (p.type === 'running' || p.type === 'low' || p.type === 'fail') {
    console.log(`  · ${p.issue}｜${p.status} (${p.type})`)
  }
  await page.waitForTimeout(5000)
}
console.log(crossed ? `✅ 跨期自動投注：${crossed.status}｜注單 ${crossed.orders} 列` : '❌ 未在時限內觀察到下一期自動投注')
console.log('page errors =', errs.length ? errs.slice(0, 5) : 'none')
await browser.close()
