#!/usr/bin/env node
/**
 * 後台「角色 / 權限」端到端測試腳本（RBAC：admin 白名單、demoMode 唯讀角色、
 * 自訂角色 CRUD、角色 x 遊戲權限開關、setRole 的自我保護規則）。
 *
 * 用法：
 *   npm run test:roles
 *   node test/test-roles.mjs
 *   BASE_URL=http://localhost:6100 node test/test-roles.mjs
 *
 * 前提：dev server 要跑著、admin 種子帳號（admin@example.com/123456）存在。
 *
 * 設計原則（跟其他盤口測試不同，這支腳本操作的是「帳號權限」本身，State 真的會
 * 持久留在 server 記憶體直到重啟，不像合成彩票期別那樣天生隔離）：
 *   1. 全部會「異動角色/白名單」的測試一律在腳本自建的臨時帳號上操作（透過
 *      POST /api/admin/members 建立），絕不碰 test01～test05 種子帳號——尤其
 *      test04 固定被指派 demo 角色，是登入頁提示文字對應的展示帳號，不可被改掉。
 *   2. 唯一會涉及「真正 admin 白名單」的操作，是把臨時帳號升為 admin 再降回 user
 *      （用來驗證多 admin 情境下的 setRole 規則），結束時一定會把臨時帳號降回
 *      'user'，確保腳本跑完後系統仍只有原本那一位 admin（admin@example.com）。
 *   3. 「不可自我降級」規則用 admin@example.com 本人直接測試即可——這條規則
 *      在送出當下就會被拒絕、不會真的異動白名單，沒有副作用風險。
 *   4. 自訂角色（非內建）CRUD 全部建立後自行刪除，不留殘留角色。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, actor, summary } = createTestRunner()

const TEMP_EMAIL = `qa-role-test-${Date.now()}@test.cc`
const TEMP_PASSWORD = '222222'

async function createTempMember() {
  section('建立臨時測試帳號（不使用 test01～test05 種子帳號）')
  const { status, body } = await api('/api/admin/members', {
    method: 'POST',
    body: JSON.stringify({ name: 'QA權限測試', email: TEMP_EMAIL, password: TEMP_PASSWORD })
  })
  ok('建立臨時帳號成功', status === 200 && Boolean(body?.user?.id), JSON.stringify(body))
  ok('臨時帳號預設角色為 user', body?.user?.role === 'user', body?.user?.role)
  return body?.user?.id
}

async function testAccessBoundaries(tempUserId) {
  section('存取邊界：未登入／一般會員／demo／admin 對讀寫端點的差異')

  const anon = actor({ label: '未登入' })
  const { status: anonStatus, body: anonBody } = await anon.api('/api/admin/roles')
  ok('未登入打唯讀端點 → 401', anonStatus === 401, `實際 ${anonStatus}`)
  ok('未登入的錯誤碼為 40001（登入已過期）', anonBody?.data?.code === 40001, JSON.stringify(anonBody))

  const member = actor({ email: TEMP_EMAIL, password: TEMP_PASSWORD, label: '一般會員（臨時帳號）' })
  await member.login()

  const { status: memberViewStatus } = await member.api('/api/admin/roles')
  ok('一般會員（role=user）打唯讀端點 → 403', memberViewStatus === 403, `實際 ${memberViewStatus}`)

  const { status: memberWriteStatus } = await member.api('/api/admin/role-defs', {
    method: 'POST',
    body: JSON.stringify({ name: '不該建立成功的角色' })
  })
  ok('一般會員打寫入端點 → 403', memberWriteStatus === 403, `實際 ${memberWriteStatus}`)

  section('指派 demo 角色後，唯讀可過、寫入仍擋')
  const { status: toDemoStatus, body: toDemoBody } = await api(`/api/admin/roles/${tempUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'demo' })
  })
  ok('指派 demo 角色成功', toDemoStatus === 200 && toDemoBody?.user?.role === 'demo', JSON.stringify(toDemoBody))

  const { status: demoViewStatus } = await member.api('/api/admin/roles')
  ok('demo 角色打唯讀端點 → 200', demoViewStatus === 200, `實際 ${demoViewStatus}`)

  // 見 replace-scratch-simulator-with-python-proxy 的追加修正：遊戲試算（刮刮樂）
  // 純模擬運算、不扣款不派彩，原本誤用 requireAdmin 把 demo 角色擋在外面，改成
  // requireAdminView 後 demo 應該能打得通——這裡只驗證不是 403（RBAC 本身的事），
  // 不要求一定是 200，因為這支端點依賴使用者本機可選的 Python 試算服務，服務沒開
  // 時會回 502，那是另一回事、不代表 RBAC 設錯。
  const { status: demoScratchInfoStatus } = await member.api('/api/admin/game-simulator/scratch-info')
  ok('demo 角色打「遊戲試算」唯讀端點不應被 403 擋下', demoScratchInfoStatus !== 403, `實際 ${demoScratchInfoStatus}`)

  const { status: demoMeStatus, body: demoMeBody } = await member.api('/api/admin/me')
  ok('/api/admin/me 回報 isDemo=true、isAdmin=false', demoMeStatus === 200 && demoMeBody?.isDemo === true && demoMeBody?.isAdmin === false, JSON.stringify(demoMeBody))

  const { status: demoWriteStatus } = await member.api('/api/admin/role-defs', {
    method: 'POST',
    body: JSON.stringify({ name: '不該建立成功的角色' })
  })
  ok('demo 角色打寫入端點仍 → 403（demoMode 天生打不了任何寫入端點）', demoWriteStatus === 403, `實際 ${demoWriteStatus}`)

  const { status: adminViewStatus } = await api('/api/admin/roles')
  ok('admin 本人打唯讀端點 → 200', adminViewStatus === 200, `實際 ${adminViewStatus}`)
}

async function testCustomRoleCrud() {
  section('自訂角色 CRUD + 角色 x 遊戲權限開關')

  const roleName = `QA測試角色-${Date.now().toString(36)}`
  const { status: createStatus, body: createBody } = await api('/api/admin/role-defs', {
    method: 'POST',
    body: JSON.stringify({ name: roleName })
  })
  ok('建立自訂角色成功', createStatus === 200 && Boolean(createBody?.role?.id), JSON.stringify(createBody))
  const roleId = createBody?.role?.id
  ok('新角色 builtin=false', createBody?.role?.builtin === false)

  const { body: listBody } = await api('/api/admin/role-defs')
  ok('角色清單包含剛建立的自訂角色', (listBody?.roles ?? []).some((r) => r.id === roleId))

  const { status: settingsStatus, body: settingsBody } = await api(`/api/admin/role-defs/${roleId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({ demoMode: true })
  })
  ok('更新角色設定（demoMode=true）成功', settingsStatus === 200 && settingsBody?.role?.demoMode === true, JSON.stringify(settingsBody))

  const { status: toggleOffStatus, body: toggleOffBody } = await api(`/api/admin/role-defs/${roleId}/games`, {
    method: 'PATCH',
    body: JSON.stringify({ category: 'retro', key: 'snake', enabled: false })
  })
  const snakeAfterOff = (toggleOffBody?.games ?? []).find((g) => g.key === 'snake')
  ok('關閉 retro/snake 權限成功', toggleOffStatus === 200 && snakeAfterOff?.enabled === false, JSON.stringify(snakeAfterOff))

  const { body: gamesBody } = await api(`/api/admin/role-defs/${roleId}/games`)
  const snakeReadBack = (gamesBody?.games ?? []).find((g) => g.key === 'snake')
  ok('重新查詢時 retro/snake 仍維持關閉（有持久化）', snakeReadBack?.enabled === false)

  const { status: deleteStatus, body: deleteBody } = await api(`/api/admin/role-defs/${roleId}`, { method: 'DELETE' })
  ok('刪除自訂角色成功', deleteStatus === 200 && deleteBody?.ok === true)

  const { body: listAfterDeleteBody } = await api('/api/admin/role-defs')
  ok('角色清單不再包含已刪除的自訂角色', !(listAfterDeleteBody?.roles ?? []).some((r) => r.id === roleId))

  const { status: deleteBuiltinStatus } = await api('/api/admin/role-defs/user', { method: 'DELETE' })
  ok('刪除內建角色（user）→ 400（內建角色不可刪除）', deleteBuiltinStatus === 400, `實際 ${deleteBuiltinStatus}`)
}

async function testSetRoleGuards(tempUserId) {
  section('setRole 保護規則：不可自我降級／角色需存在')

  const { body: meBody } = await api('/api/admin/me')
  const selfId = meBody?.user?.id
  ok('取得目前 admin 自己的帳號 id', Boolean(selfId), JSON.stringify(meBody))

  const { status: selfDemoteStatus, body: selfDemoteBody } = await api(`/api/admin/roles/${selfId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'user' })
  })
  ok('admin 嘗試把自己降級 → 400（不可自我降級）', selfDemoteStatus === 400, JSON.stringify(selfDemoteBody))

  const { body: stillAdminBody } = await api('/api/admin/me')
  ok('自我降級被拒後，自己仍是 admin', stillAdminBody?.isAdmin === true)

  const { status: invalidRoleStatus } = await api(`/api/admin/roles/${tempUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'not-a-real-role' })
  })
  ok('指派不存在的角色 → 400', invalidRoleStatus === 400, `實際 ${invalidRoleStatus}`)
}

async function testMultiAdminPromotionAndDemotion(tempUserId) {
  section('多 admin 情境：臨時帳號升為 admin、以新 admin 身分操作、再降回 user（確保測完只剩原本 1 位 admin）')

  const { status: promoteStatus, body: promoteBody } = await api(`/api/admin/roles/${tempUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'admin' })
  })
  ok('把臨時帳號升為 admin 成功', promoteStatus === 200 && promoteBody?.user?.role === 'admin', JSON.stringify(promoteBody))

  const promoted = actor({ email: TEMP_EMAIL, password: TEMP_PASSWORD, label: '臨時帳號（已升為 admin）' })
  await promoted.login()

  const { status: promotedViewStatus } = await promoted.api('/api/admin/roles')
  ok('新 admin 身分打唯讀端點 → 200', promotedViewStatus === 200, `實際 ${promotedViewStatus}`)

  const { status: promotedWriteStatus } = await promoted.api('/api/admin/role-defs', {
    method: 'POST',
    body: JSON.stringify({ name: '不該留下的角色' })
  })
  ok('新 admin 身分打寫入端點 → 200（白名單 admin 可寫）', promotedWriteStatus === 200, `實際 ${promotedWriteStatus}`)

  // 清掉上面那個順手驗證寫入權限時建立的角色，避免留下測試髒資料
  const { body: cleanupListBody } = await api('/api/admin/role-defs')
  const strayRole = (cleanupListBody?.roles ?? []).find((r) => r.name === '不該留下的角色')
  if (strayRole) {
    await api(`/api/admin/role-defs/${strayRole.id}`, { method: 'DELETE' })
  }

  const { status: selfDemoteAsNewAdminStatus } = await promoted.api(`/api/admin/roles/${tempUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'user' })
  })
  ok('新 admin 嘗試把自己降級 → 400（自我降級規則對任何 admin 都成立）', selfDemoteAsNewAdminStatus === 400, `實際 ${selfDemoteAsNewAdminStatus}`)

  const { status: demoteStatus, body: demoteBody } = await api(`/api/admin/roles/${tempUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'user' })
  })
  ok('改由原本的 admin 把臨時帳號降回 user 成功（還原白名單）', demoteStatus === 200 && demoteBody?.user?.role === 'user', JSON.stringify(demoteBody))

  const { status: afterDemoteViewStatus } = await promoted.api('/api/admin/roles')
  ok('降回 user 後，臨時帳號的 session 立即打唯讀端點 → 403（沒有殘留權限）', afterDemoteViewStatus === 403, `實際 ${afterDemoteViewStatus}`)
}

async function main() {
  console.log('角色 / 權限（RBAC）測試腳本開始')
  await login()

  const tempUserId = await createTempMember()
  if (!tempUserId) {
    console.error('臨時帳號建立失敗，無法繼續測試。')
    process.exitCode = 1
    summary()
    return
  }

  await testAccessBoundaries(tempUserId)
  await testCustomRoleCrud()
  await testSetRoleGuards(tempUserId)
  await testMultiAdminPromotionAndDemotion(tempUserId)

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
