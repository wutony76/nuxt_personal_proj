import { createTestRunner } from './_test-utils.mjs'

/**
 * 一次性驗證腳本：確認 6 款每日開獎的 tw 玩法在今晚真實截止＋結算時，
 * 期別會正確從「開盤中」→「結算中（等待官方資料）」→ 推進到下一期「開盤中」，
 * 不會卡在等待官方資料的狀態。用法同 test-*.mjs：BASE_URL=http://localhost:6100 node scripts/_watch-tw-settlement.mjs
 *
 * 背景：賓果賓果（5 分鐘一期）已手動驗證過同一套流程正常，只是等待官方資料要花約 1~2 分鐘；
 * 這 6 款每日一期的玩法用同一套輪詢重試架構，但今天沒機會等到真實截止時間，
 * 這支腳本就是排程在截止前啟動，实際觀察一次真實結算週期。
 * ⚠️ 不含 superlotto（威力彩）：今天不開獎（下次截止在 3 天後），這輪不驗證。
 */

const { api, login } = createTestRunner()
await login()

const GAMES = [
  ['dlt', '大樂透'],
  ['d539', '今彩539'],
  ['m649', '49樂合彩'],
  ['m539', '39樂合彩'],
  ['p3', '3星彩'],
  ['p4', '4星彩']
]

async function snapshot(key) {
  const { body } = await api(`/api/lottery-tw/${key}/current`)
  return body
}

const start = {}
for (const [key, name] of GAMES) {
  const s = await snapshot(key)
  start[key] = { name, issue: s?.issue, status: s?.currentStatus }
  console.log(`[起始] ${name}(${key}): issue=${s?.issue} status=${s?.currentStatus} cutoffAt=${s?.cutoffAt ? new Date(s.cutoffAt).toISOString() : '-'}`)
}

const settled = new Set()
const startedAt = Date.now()
const maxWaitMs = 20 * 60 * 1000 // 20 分鐘上限

while (Date.now() - startedAt < maxWaitMs && settled.size < GAMES.length) {
  await new Promise((r) => setTimeout(r, 15000))
  const elapsed = Math.round((Date.now() - startedAt) / 1000)
  for (const [key, name] of GAMES) {
    if (settled.has(key)) continue
    const s = await snapshot(key)
    const startIssue = start[key].issue
    if (s?.issue !== startIssue && s?.lastOpenCode?.issue === startIssue) {
      console.log(`[t=${elapsed}s] ✔ ${name}(${key}) 期別已從 ${startIssue} 推進到 ${s.issue}，lastOpenCode 對應正確`)
      settled.add(key)
    } else {
      console.log(`[t=${elapsed}s] ${name}(${key}): issue=${s?.issue} status=${s?.currentStatus}`)
    }
  }
}

console.log('\n=================================')
for (const [key, name] of GAMES) {
  console.log(settled.has(key) ? `✔ ${name}(${key}) 結算成功` : `✘ ${name}(${key}) 逾時仍未結算完成（可能卡住）`)
}
console.log(settled.size === GAMES.length ? '全部通過 ✔' : `${settled.size}/${GAMES.length} 通過`)
process.exit(settled.size === GAMES.length ? 0 : 1)
