#!/usr/bin/env node
/**
 * 聊天室（WebSocket 即時社交）端到端測試腳本：連線生命週期、發言身分/內容驗證、
 * 管理者身分發言、在線人數廣播，以及後台聊天室排程（chat schedules）的權限邊界。
 *
 * 用法：
 *   npm run test:chat
 *   node scripts/test-chat.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-chat.mjs
 *
 * 前提：
 *   - dev server 要跑著（預設 port 6100），種子帳號 admin@example.com／123456、
 *     test01@test.cc／test02@test.cc（密碼 222222）都存在（見 hfyyManage.ts setStartData）。
 *   - WebSocket 端點 /api/ws/social 是裸 WebSocket（非 socket.io），協定是
 *     `{ type, payload }` JSON envelope（見 server/services/social/socketHub.ts）。
 *     瀏覽器原生 WebSocket 建構子不支援自訂 headers，這裡改用 `ws` 套件
 *     （已在 node_modules 裡，見 package.json devDependencies）手動帶 Cookie
 *     才能讓 server 端 socketAuth.identify() 辨識出登入身分。
 *
 * ⚠️ 在線人數（chat:online）斷言刻意用「相對變化」而非寫死絕對數字——
 * dev server 可能同時有真人開著瀏覽器分頁連線，絕對數字會隨時浮動，
 * 相對變化（開新連線後數字應該變大、關閉後應該變小）才是穩定可驗證的事實。
 *
 * ⚠️ 聊天歷史／訊息不清除（跟其他測試腳本一致的設計哲學），送出的訊息會留在
 * server 記憶體的 ring buffer（上限 50 筆）裡，重啟才會清空，不影響正式使用。
 */

import WebSocket from 'ws'
import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, actor, summary } = createTestRunner()

const BASE_URL = process.env.BASE_URL || 'http://localhost:6100'
const WS_URL = `${BASE_URL.replace(/^http/, 'ws')}/api/ws/social`

function openSocket(cookie) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, cookie ? { headers: { Cookie: cookie } } : undefined)
    const messages = []

    ws.on('message', (raw) => {
      let msg = null
      try { msg = JSON.parse(raw.toString()) } catch { /* 非 JSON 訊息忽略 */ }
      messages.push(msg)
    })
    ws.once('open', () => resolve(client))
    ws.once('error', reject)

    function waitForCount(predicate, minCount, timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs
      return new Promise((res, rej) => {
        const timer = setInterval(() => {
          const matched = messages.filter(predicate)
          if (matched.length >= minCount) {
            clearInterval(timer)
            res(matched[minCount - 1])
            return
          }
          if (Date.now() > deadline) {
            clearInterval(timer)
            rej(new Error(`等待訊息逾時（目前符合 ${matched.length} 筆，需要 ${minCount} 筆）`))
          }
        }, 50)
      })
    }

    function send(type, payload) {
      ws.send(JSON.stringify({ type, payload }))
    }

    const client = { ws, messages, waitForCount, send }
  })
}

async function testConnectionLifecycle() {
  section('連線生命週期：連線即收到歷史訊息、在線人數隨連線數變化')

  const connA = await openSocket()
  const historyA = await connA.waitForCount((m) => m?.type === 'chat:history', 1).catch(() => null)
  ok('連線後立即收到 chat:history', Array.isArray(historyA?.payload?.messages), JSON.stringify(historyA))

  const onlineA1 = await connA.waitForCount((m) => m?.type === 'chat:online', 1).catch(() => null)
  ok('連線後收到 chat:online（含自己）', typeof onlineA1?.payload?.count === 'number', JSON.stringify(onlineA1))
  const baselineCount = onlineA1?.payload?.count ?? 0

  const connB = await openSocket()
  const onlineA2 = await connA.waitForCount((m) => m?.type === 'chat:online', 2).catch(() => null)
  ok(
    '另一條連線進來後，既有連線收到的在線人數會變多（相對變化，不假設絕對值）',
    typeof onlineA2?.payload?.count === 'number' && onlineA2.payload.count > baselineCount,
    `之前 ${baselineCount}、之後 ${onlineA2?.payload?.count}`
  )
  const afterOpenCount = onlineA2?.payload?.count ?? baselineCount

  connB.ws.close()
  const onlineA3 = await connA.waitForCount((m) => m?.type === 'chat:online', 3).catch(() => null)
  ok(
    '該連線關閉後，在線人數會變少',
    typeof onlineA3?.payload?.count === 'number' && onlineA3.payload.count < afterOpenCount,
    `關閉前 ${afterOpenCount}、關閉後 ${onlineA3?.payload?.count}`
  )

  connA.ws.close()
}

async function testSendValidation() {
  section('發言驗證：未登入／空白／過長／成功廣播／速率限制')

  const anonConn = await openSocket()
  anonConn.send('chat:send', { text: '沒登入也想發言' })
  const unauthorized = await anonConn.waitForCount((m) => m?.type === 'error', 1).catch(() => null)
  ok('未登入發言 → unauthorized', unauthorized?.payload?.code === 'unauthorized', JSON.stringify(unauthorized))
  anonConn.ws.close()

  const user1 = actor({ email: 'test01@test.cc', password: '222222', label: 'test01' })
  await user1.login()
  const conn1 = await openSocket(user1.getCookie())

  conn1.send('chat:send', { text: '' })
  const emptyErr = await conn1.waitForCount((m) => m?.type === 'error', 1).catch(() => null)
  ok('空白訊息 → empty_text', emptyErr?.payload?.code === 'empty_text', JSON.stringify(emptyErr))

  conn1.send('chat:send', { text: '長'.repeat(201) })
  const tooLongErr = await conn1.waitForCount((m) => m?.type === 'error', 2).catch(() => null)
  ok('超過 200 字 → text_too_long', tooLongErr?.payload?.code === 'text_too_long', JSON.stringify(tooLongErr))

  // 比對時用「送出的確切文字」而非泛用的 chat:message 型別——dev server 本身有
  // 種子排程會每 5～30 秒自動廣播系統訊息（見 hfyyManage.ts setStartData），
  // 用型別篩選可能剛好先抓到那則系統廣播而不是自己剛送出的這則，誤判失敗。
  const greeting = `自動測試訊息 ${Date.now()}`
  conn1.send('chat:send', { text: greeting })
  const broadcasted = await conn1.waitForCount((m) => m?.type === 'chat:message' && m?.payload?.text === greeting, 1).catch(() => null)
  ok(
    '合法訊息送出後收到全站廣播，內容與送出者正確',
    broadcasted?.payload?.text === greeting && broadcasted?.payload?.userName === 'test01' && !broadcasted?.payload?.asAdmin,
    JSON.stringify(broadcasted)
  )

  conn1.send('chat:send', { text: '緊接著馬上再發一次' })
  const rateLimited = await conn1.waitForCount((m) => m?.type === 'error', 3).catch(() => null)
  ok('1.5 秒內再次發言 → rate_limited', rateLimited?.payload?.code === 'rate_limited', JSON.stringify(rateLimited))

  conn1.ws.send('not valid json {{{')
  const badRequest = await conn1.waitForCount((m) => m?.type === 'error', 4).catch(() => null)
  ok('送出非 JSON 內容 → bad_request', badRequest?.payload?.code === 'bad_request', JSON.stringify(badRequest))

  conn1.send('chat:not-a-real-type', {})
  const unknownType = await conn1.waitForCount((m) => m?.type === 'error', 5).catch(() => null)
  ok('未知訊息類型 → unknown_type', unknownType?.payload?.code === 'unknown_type', JSON.stringify(unknownType))

  conn1.ws.close()
}

async function testAdminIdentitySend() {
  section('asAdmin 發言：一般會員不可宣稱管理者身分，白名單 admin 可以')

  const user2 = actor({ email: 'test02@test.cc', password: '222222', label: 'test02' })
  await user2.login()
  const conn2 = await openSocket(user2.getCookie())

  conn2.send('chat:send', { text: '我不是admin也想當admin發言', asAdmin: true })
  const forbidden = await conn2.waitForCount((m) => m?.type === 'error', 1).catch(() => null)
  ok('一般會員宣稱 asAdmin → forbidden', forbidden?.payload?.code === 'forbidden', JSON.stringify(forbidden))
  conn2.ws.close()

  const adminActor = actor({ email: process.env.DLT_TEST_EMAIL || 'admin@example.com', password: process.env.DLT_TEST_PASSWORD || '123456', label: 'admin（連線用）' })
  await adminActor.login()
  const connAdmin = await openSocket(adminActor.getCookie())
  const adminText = `管理者廣播測試 ${Date.now()}`
  connAdmin.send('chat:send', { text: adminText, asAdmin: true })
  const adminMessage = await connAdmin.waitForCount((m) => m?.type === 'chat:message' && m?.payload?.text === adminText, 1).catch(() => null)
  ok(
    'admin 宣稱 asAdmin 發言成功，顯示名稱為「管理者: ...」',
    adminMessage?.payload?.text === adminText && adminMessage?.payload?.asAdmin === true && String(adminMessage?.payload?.userName ?? '').startsWith('管理者: '),
    JSON.stringify(adminMessage)
  )
  connAdmin.ws.close()
}

async function testChatSchedulePermissions() {
  section('後台聊天室排程：admin 可讀寫，一般會員讀寫皆擋')

  const { status: listStatus, body: listBody } = await api('/api/admin/chat/schedules')
  ok('admin 讀取排程列表 → 200', listStatus === 200 && Array.isArray(listBody?.schedules), JSON.stringify(listBody))

  const { status: createStatus, body: createBody } = await api('/api/admin/chat/schedules', {
    method: 'POST',
    body: JSON.stringify({ text: '（自動測試排程，不會真的很快觸發）', repeat: 'interval', intervalSeconds: 86400 })
  })
  ok('admin 新增排程成功', createStatus === 200 && Boolean(createBody?.schedule?.id), JSON.stringify(createBody))
  const scheduleId = createBody?.schedule?.id

  const { status: patchStatus, body: patchBody } = await api(`/api/admin/chat/schedules/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled: false })
  })
  ok('admin 關閉排程成功', patchStatus === 200 && patchBody?.schedule?.enabled === false, JSON.stringify(patchBody))

  const { status: deleteStatus, body: deleteBody } = await api(`/api/admin/chat/schedules/${scheduleId}`, { method: 'DELETE' })
  ok('admin 刪除排程成功（不留測試髒資料）', deleteStatus === 200 && deleteBody?.ok === true, JSON.stringify(deleteBody))

  const member = actor({ email: 'test01@test.cc', password: '222222', label: 'test01（排程權限）' })
  await member.login()

  const { status: memberListStatus } = await member.api('/api/admin/chat/schedules')
  ok('一般會員讀取排程列表 → 403', memberListStatus === 403, `實際 ${memberListStatus}`)

  const { status: memberCreateStatus } = await member.api('/api/admin/chat/schedules', {
    method: 'POST',
    body: JSON.stringify({ text: '不該建立成功', repeat: 'interval', intervalSeconds: 86400 })
  })
  ok('一般會員新增排程 → 403', memberCreateStatus === 403, `實際 ${memberCreateStatus}`)
}

async function main() {
  console.log('聊天室（WebSocket 社交）測試腳本開始')
  await login()

  await testConnectionLifecycle()
  await testSendValidation()
  await testAdminIdentitySend()
  await testChatSchedulePermissions()

  summary()
  process.exit(process.exitCode || 0)
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
  process.exit(1)
})
