# Design

> 規劃階段設計草案，已套用 proposal.md「已決定事項」。仍有少數細節（BG 15 款盤口各自的
> 合法下注 payload）要等實作階段逐一確認，先在文件裡標記，不影響整體架構定案。

## 1. Layout Structure（頁面結構）

- Route / Page：新增 `app/pages/admin/npc.vue`
- 放置位置：「角色 / 權限」（`Shell.vue` 既有頂層 nav），跟 `/admin/roles` 平行——比照
  「遊戲設定」底下用 `GameNav.vue` 橫向 tabs 切子頁的做法，新增
  `AdminRolesNav.vue`：`角色與會員`（現有 `/admin/roles`）／`NPC`（新頁）
- Sections（`npc.vue` 內）：
  1. 總開關：狀態文字（開啟中／已關閉）+ 切換按鈕（比照 `taiwan-lottery.vue` 柑仔店櫥仔
     設定的 `atl-toyshop-toggle` 樣式）
  2. 排程參數：檢查間隔、BG/經典遊戲選擇權重、經典遊戲模擬分數區間、BG 單注金額 ——
     用小型表單，套「建議預設值」，皆可調整
  3. NPC 會員清單：卡片或表格，每列顯示名稱／Email／F幣餘額／今日已花費／
     `dailyMaxSpend`／`topUpAmount`（後兩者可編輯，比照 `taiwan-lottery.vue` 柑仔店櫥仔
     賠率編輯的「編輯→輸入→儲存」模式）
  4. 可自動遊玩的遊戲清單：四分類卡片格
     - BG 彩票／經典遊戲：可勾選（`allowed: boolean`，即時生效）
     - 台彩鏡射玩法／柑仔店櫥仔：整區顯示但每張卡片 `disabled`，加上「即將支援」小標籤
- 響應式斷點策略：沿用既有 admin 頁面慣例

## 2. Component Breakdown（元件拆分）

- 新增元件：
  - `app/components/admin/AdminRolesNav.vue`（比照 `GameNav.vue`）
  - 頁面內 inline template 為主；若「遊戲勾選格」或「會員清單編輯」邏輯複雜，可抽成
    `NpcGamePicker.vue`／`NpcMemberList.vue`（實作階段視程式碼量再決定，非硬性要求）
- 既有元件調整：
  - `app/pages/admin/reports/fcoin.vue`／`settlement.vue`／`plays.vue`／
    `taiwan-lottery.vue`／`members.vue`：報表區塊補上 NPC／真人分流顯示（見 Section 9）

## 3. State 設計

### local state（`npc.vue`）

```ts
const npc = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  enabled: false,
  togglePending: false,
  schedule: {                          // 排程參數，對應「建議預設值」
    tickIntervalSec: 30,
    bgWeight: 50,
    retroWeight: 50,
    retroScoreMinPct: 10,
    retroScoreMaxPct: 40,
    bgBetAmountMin: 10,
    bgBetAmountMax: 150,
  },
  scheduleSaving: false,
  members: [] as NpcMemberRow[],       // 篩選 role === 'npc'
  memberEditingId: null as string | null,
  memberDraft: { dailyMaxSpend: '', topUpAmount: '' },
  games: [] as NpcGameItem[],          // 60 款，含 category/key/name/allowed/supported
  gameTogglePending: {} as Record<string, boolean>,
})
```

### global state

- 不使用 Pinia，沿用頁面內 `reactive`

## 4. Interaction Flow（click / actions / _handlers）

- `click.toggleNpc()` → `PATCH /api/admin/npc/settings { enabled }`
- `click.saveSchedule()` → `PATCH /api/admin/npc/settings { schedule: {...} }`（跟總開關
  同一個 settings 端點，欄位分開送）
- `click.toggleGame(item)` → `PUT /api/admin/npc/games/:category/:key { allowed }`
  （只對 `supported: true` 的分類生效，`tw`/`toys` 的按鈕本身就是 disabled，不會觸發）
- `click.startEditMember(row)` / `click.cancelEditMember()` / `click.saveMember(row)` →
  `PATCH /api/admin/npc/members/:userId/settings { dailyMaxSpend, topUpAmount }`

## 5. API Contract（規劃階段草案）

### GET /api/admin/npc/settings

```ts
/**
 * 後台：NPC 自動遊玩總開關、排程參數、四分類遊戲清單（含是否已支援/是否勾選）
 * @returns {Promise<{
 *   enabled: boolean
 *   schedule: { tickIntervalSec: number; bgWeight: number; retroWeight: number;
 *     retroScoreMinPct: number; retroScoreMaxPct: number; bgBetAmountMin: number; bgBetAmountMax: number }
 *   games: Array<{ category: 'bg'|'retro'|'tw'|'toys'; key: string; name: string;
 *     supported: boolean; allowed: boolean }>
 * }>}
 */
```

### PATCH /api/admin/npc/settings

```ts
/**
 * 後台：更新 NPC 總開關與/或排程參數（未帶到的欄位維持原值）
 * @param {{ enabled?: boolean; schedule?: Partial<ScheduleConfig> }} body
 * @returns {Promise<{ enabled: boolean; schedule: ScheduleConfig }>}
 */
```

### PUT /api/admin/npc/games/:category/:key

```ts
/**
 * 後台：切換單一遊戲是否允許 NPC 自動遊玩（category 為 'tw'/'toys' 時一律拒絕，尚未支援）
 * @param {{ allowed: boolean }} body
 * @returns {Promise<{ category: string; key: string; allowed: boolean }>}
 */
```

### PATCH /api/admin/npc/members/:userId/settings

```ts
/**
 * 後台：設定單一 NPC 會員的每日花費上限與自動儲值金額
 * @param {string} userId
 * @param {{ dailyMaxSpend: number; topUpAmount: number }} body
 * @returns {Promise<{ userId: string; dailyMaxSpend: number; topUpAmount: number }>}
 */
```

（會員清單重用既有 `GET /api/admin/roles`，前端篩選 `role === 'npc'`，再合併
`npcAutoPlayService` 的 per-member 設定與「今日已花費」）

## 6. Token Mapping（Figma 對應）

- 沿用既有後台頁面 token（`admin-panel`／`admin-table`／`admin-grid1`／`admin-btn-*`）

## 7. 錯誤處理與可觀測性

- `npc.status`：`idle → loading → success/error`
- 各區塊（總開關／排程參數／會員設定／遊戲勾選）各自獨立的 pending/error 狀態，不互相
  卡住
- 後端排程 `tick()` 對每個 NPC、每個行動都用 try/catch 包住，單一失敗只跳過該次，不中斷
  其他 NPC 或中斷整個 `circle()` 心跳

## 8. 後端排程與經濟迴圈設計

### 8.1 NPC 會員設定資料

```ts
type NpcMemberSetting = {
  dailyMaxSpend: number   // 預設 50000
  topUpAmount: number     // 預設 2000
}
const _memberSettings = new Map<string, NpcMemberSetting>() // userId -> setting，未設定的 NPC 用預設值
const _dailySpent = new Map<string, { dateKey: string; amount: number }>() // 今日已花費追蹤，跨日重置
```

### 8.2 tick() 主流程（比照 chatSchedule.tick() 的節流寫法）

```ts
let _lastTickAt = 0

function tick(now: number) {
  if (!_enabled) return
  if (now - _lastTickAt < _schedule.tickIntervalSec * 1000) return
  _lastTickAt = now

  const npcUserIds = /* Storage.users 裡 roleOf(userId) === 'npc' 的全部 id */
  for (const userId of npcUserIds) {
    try { _actOnce(userId) } catch { /* 單一 NPC 失敗不影響其他人 */ }
  }
}

function _actOnce(userId: string) {
  const playBg = Math.random() * (_schedule.bgWeight + _schedule.retroWeight) < _schedule.bgWeight
  if (playBg) return _playRandomBgGame(userId)
  return _playRandomRetroGame(userId)
}
```

### 8.3 經典遊戲／遊戲中心（收入）

```ts
function _playRandomRetroGame(userId: string) {
  const pool = _allowedGames('retro') // 已勾選、supported 的 retro key
  if (pool.length === 0) return
  const key = pool[Math.floor(Math.random() * pool.length)]
  const game = Storage.retroGames.instances[key]
  const pct = _schedule.retroScoreMinPct + Math.random() * (_schedule.retroScoreMaxPct - _schedule.retroScoreMinPct)
  const score = Math.floor(game.maxReasonableScore() * (pct / 100))
  game.actions.record(userId, { score }) // 既有結算流程：算 coinReward、寫 balanceChanges、套 coinDailyCap
}
```

- 不需要檢查餘額（玩遊戲中心不用先有錢），`coinDailyCap`/`coinCapPerRun` 是既有機制自然
  擋住灌水

### 8.4 BG 彩票（支出，含每日上限與自動儲值）

```ts
function _playRandomBgGame(userId: string) {
  const pool = _allowedGames('bg')
  if (pool.length === 0) return
  const key = pool[Math.floor(Math.random() * pool.length)]

  const setting = _memberSettings.get(userId) ?? DEFAULT_MEMBER_SETTING
  const spentToday = _spentToday(userId)
  if (spentToday >= setting.dailyMaxSpend) return // 今日額度用完，跳過

  const amount = _schedule.bgBetAmountMin +
    Math.floor(Math.random() * (_schedule.bgBetAmountMax - _schedule.bgBetAmountMin + 1))
  const user = Storage.get.user(userId)
  if (Number(user.coin ?? 0) < amount) {
    _topUp(userId, setting.topUpAmount) // 記一筆 admin-topup
  }

  const payload = _buildMinimalBetPayload(key) // 每個盤口各自的最小合法下注，實作階段逐一確認
  Storage.games[key].playBets(payload, user) // 跟 server/api/lottery/bet.post.ts 呼叫方式相同
  _addSpent(userId, amount)
}

function _topUp(userId: string, amount: number) {
  walletBalanceService.appendChange(userId, {
    type: 'admin-topup',
    amount,
    note: 'NPC 自動儲值'
  })
}
```

- `_buildMinimalBetPayload(key)`：BG 15 款盤口的合法下注格式不完全一致（號碼／位數／
  期別規則），實作階段需要逐一對照各盤口既有的 `validateBetQuota`／下注驗證邏輯，先做
  1～2 個盤口打通架構，其餘依序補上（見 tasks.md）

### 8.5 `HFYYManage.circle()` 整合

```ts
// server/services/admin/hfyyManage.ts
circle() {
  this.chatSchedule.tick()
  this.npcAutoPlay.tick(Date.now())
}
```

## 9. 報表 NPC／真人分流設計

- 影響檔案：`server/api/admin/reports/fcoin-summary.get.ts`、`bg-summary.get.ts`、
  `tw-lottery-payout.get.ts`、會員報表（`members.get.ts`）
- 共同作法：這幾份報表原本都是逐 `userId` 迴圈累加金額/筆數，改成先判斷
  `Storage.manager.admin.access.roleOf(userId) === 'npc'`，分兩組累加器（`real`/`npc`），
  回應多帶一個 `npc` 區塊（形狀跟原本的 `summary`/`perGame` 一致），前端頁面在既有 KPI
  卡片旁多顯示一組「NPC」數字（或用 tab/toggle 切換，實作階段依畫面空間決定）
- 不新增報表頁面、不改既有回應的既有欄位（相容既有前端），只是多回一個 `npc` 子物件

## 10. 測試與驗證策略

- 無自動化測試框架（沿用專案現況）
- 手動測試案例（實作階段）：
  1. 開啟總開關 → 等待排程間隔 → 確認至少一個 NPC 會員產生 `game-reward`（經典遊戲）或
     BG 下注紀錄
  2. 關閉總開關 → 確認排程不再產生新的異動記錄（已進行中的單次呼叫本來就同步完成，
     不會有「半途中斷」的情況）
  3. NPC 某會員 `dailyMaxSpend` 設低一點 → 確認達到上限後當天不再產生 BG 下注、換日後
     恢復
  4. 故意把 NPC 會員 coin 清到接近 0 → 確認下次 BG 下注前觸發 `admin-topup`，且金額等於
     該會員設定的 `topUpAmount`
  5. 取消勾選某款 BG／經典遊戲 → 確認 NPC 不再對該款遊戲行動，其他已勾選遊戲不受影響
  6. 報表頁面（fcoin/bg-summary/tw-lottery-payout/會員）能看到 NPC 與真人分開的數字，
     兩者加總等於原本的合計數
