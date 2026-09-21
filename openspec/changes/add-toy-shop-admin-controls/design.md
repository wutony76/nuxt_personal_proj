# Design

## 1. Layout Structure（頁面結構）

- Route / Page：`app/pages/admin/taiwan-lottery.vue`（既有頁面，新增區塊，不新增路由）
- Sections：既有「KPI 卡片」「玩法明細」「中獎明細」之後，新增「柑仔店櫥仔設定」
- Blocks：
  - 開關列：目前狀態文字（開放中／暫停中）+ 切換按鈕
  - 賠率卡片格：`admin-grid1` 髮絲線分格（跟頁面其他 KPI 卡片同一套視覺語言，4 欄 × 2 列，
    使用者要求改為卡片而非表格），每張卡片含：
    - 玩法 slug（`admin-en`）／名稱
    - 狀態（啟用中／已關閉，實心／空心圓點 + 開啟中卡片邊框轉綠色）+ 開啟／關閉切換按鈕
    - 賠率倍數、難度（0～100% 額外未中獎機率）：同一個編輯態下兩個欄位，比照 `games.vue`
      的 coin 常數編輯 UX（點「編輯」→ 兩個 input 可改→「儲存」一次送出兩個值/「取消」）
- 響應式斷點策略：沿用頁面既有 `.atl-*` class 慣例，卡片格在 ≤640px 收成 2 欄

## 2. Component Breakdown（元件拆分）

- 新增元件：無（維持頁面內 inline template，比照 `games.vue`／`fcoin.vue` 現有慣例：中小型
  後台頁面不拆元件）
- 既有元件調整：
  - `app/pages/lottery-hall-taiwan.vue`：柑仔店櫥仔 `<section>` 外層加 `v-if`，關閉時整塊
    不渲染（含標題／購買紀錄按鈕），不是區塊內顯示提示文字
- 職責與邊界：
  - `taiwan-lottery.vue` 只做「讀取設定→顯示→送出變更」，驗證邏輯（賠率必須 ≥ 0）交給後端
    `toyShop.ts` 把關，前端只做基本必填檢查

## 3. State 設計

### local state（單一 reactive 為主）

- `toyShop`（`taiwan-lottery.vue` 新增一個獨立 `reactive`，跟既有 `month`/`summary` 分開管理，
  因為兩者的 loading 生命週期彼此獨立）：
  ```ts
  const toyShop = reactive({
    status: 'idle' as AsyncStatus,
    error: '',
    enabled: true,
    odds: [] as ToyShopOddsItem[],
    togglePending: false,
    gameTogglePending: {} as Record<string, boolean>,
    editingSlug: null as string | null,
    draftMultiplier: '',
    draftDifficulty: '',
    editError: '',
  })
  ```
- `uiState`：不需要，用上面 `toyShop.editingSlug` 判斷哪一列進入編輯態即可
- `formState`：不需要，賠率／難度編輯只有兩個欄位，用 `draftMultiplier`/`draftDifficulty`
  字串暫存即可

### global state（Pinia setup store）

- 不使用 Pinia：專案目前全域狀態走 composable 單例（`useToyHistory` 等），這裡是單頁後台設定，
  沿用頁面內 `reactive`，不新增 store

## 4. Interaction Flow（click / actions / _handlers）

- `click.toggleShop()`（UI 入口）
  - 觸發條件：點擊開關按鈕
  - 轉交 `actions.toggleShop()`
- `actions.toggleShop()`
  - loading guard：`toyShop.togglePending` 為 true 時直接 return
  - early return：無
  - success flow：呼叫 `api.admin.toyShop.setEnabled(!toyShop.enabled)`，成功後更新
    `toyShop.enabled`
  - error flow：`toyShop.error` 顯示錯誤訊息，`enabled` 維持原值（不假設成功）
- `click.startEditOdds(row)` / `click.cancelEditOdds()`（UI 入口）
  - 進入/退出編輯態，設定 `editingSlug`/`draftMultiplier`/`draftDifficulty`
- `actions.saveOdds(row)`
  - loading guard：以 `editingSlug` 是否為該列 slug 判斷是否重複送出
  - early return：`draftMultiplier` 非數字或 < 0，或 `draftDifficulty` 非數字／不在 0~100
    範圍時，設 `editError` 並 return，不送出請求
  - success flow：呼叫 `api.admin.toyShop.setOdds(slug, { multiplier, difficulty })`，
    一次送出兩個值，成功後更新 `toyShop.odds` 對應列、清空編輯態
  - error flow：`toyShop.editError` 顯示後端回傳訊息（例如賠率或難度格式錯誤）
- `click.toggleGame(row)`（UI 入口）
  - 轉交 `actions.toggleGame(row)`
- `actions.toggleGame(row)`
  - loading guard：`toyShop.gameTogglePending[row.slug]` 為 true 時直接 return
  - early return：無
  - success flow：呼叫 `api.admin.toyShop.setGameEnabled(row.slug, !row.enabled)`，成功後
    以回應更新 `toyShop.odds` 對應列（同一個物件同時帶 `multiplier`／`enabled`）
  - error flow：`toyShop.error` 顯示錯誤訊息，該列 `enabled` 維持原值
- `_handlers`：不需要額外資料轉換，API 回應已是可直接渲染的形狀

## 5. API Contract（JSDoc 必填）

### GET /api/admin/toy-shop/settings

- request schema：無（admin session）
- response schema：`{ enabled: boolean; odds: Array<{ slug: string; name: string; multiplier: number; enabled: boolean }> }`
- error cases：401/403（非 admin）

```ts
/**
 * 後台：柑仔店櫥仔目前開關狀態與各玩法賠率倍數
 * @returns {Promise<{ enabled: boolean; odds: ToyShopOddsItem[] }>}
 */
```

### PATCH /api/admin/toy-shop/settings

- request schema：`{ enabled: boolean }`
- response schema：`{ enabled: boolean }`
- error cases：400（`enabled` 非 boolean）、401/403

```ts
/**
 * 後台：切換柑仔店櫥仔整體開關
 * @param {{ enabled: boolean }} body
 * @returns {Promise<{ enabled: boolean }>}
 */
```

### PUT /api/admin/toy-shop/odds/:slug

- request schema：`{ multiplier: number; difficulty: number }`
- response schema：`{ slug: string; name: string; multiplier: number; difficulty: number; enabled: boolean }`
- error cases：400（`multiplier` 非數字或 < 0；或 `difficulty` 非數字／≤ 0）、
  404（slug 不存在）、401/403

```ts
/**
 * 後台：設定單一玩法的賠率倍數（套用在實際派彩金額上）與難度（預設 1，越大越難贏，真的
 * 改變中獎機率，接進該玩法自己的隨機邏輯）
 * @param {string} slug
 * @param {{ multiplier: number; difficulty: number }} body
 * @returns {Promise<ToyShopOddsItem>}
 */
```

### PATCH /api/admin/toy-shop/games/:slug

- request schema：`{ enabled: boolean }`
- response schema：`{ slug: string; name: string; multiplier: number; enabled: boolean }`
- error cases：400（`enabled` 非 boolean）、404（slug 不存在）、401/403

```ts
/**
 * 後台：單一柑仔店玩法上架／下架
 * @param {string} slug
 * @param {{ enabled: boolean }} body
 * @returns {Promise<ToyShopOddsItem>}
 */
```

### GET /api/games/toys/catalog（既有端點，回應與行為變更）

- response schema 新增：`enabled: boolean`（柑仔店櫥仔目前是否開放）
- `items` 會過濾掉目前被下架（單一玩法 `enabled: false`）的玩法，前台不會拿到、也就不會顯示

### POST /api/games/toys/:slug/roll（既有 8 個端點，行為變更）

- 整店關閉時：回 403 `{ message: '柑仔店櫥仔目前暫停開放。' }`
- 該玩法被下架時：回 403 `{ message: '此玩法目前暫停開放。' }`
- 呼叫玩法自己的 `playXxx()` 時多帶一個 `difficulty: toyShop.difficultyOf(slug)` 參數，
  由玩法自己的 service 檔決定怎麼套用（見 `server/services/game/toys/difficulty.ts` 與各
  玩法檔案頂部的校準註解）——中獎與否在玩法內部就已經是最終結果，`roll.post.ts` 不再事後
  攔截
- 中獎入帳（`wallet.credit` 呼叫點）：`amount` 乘上該玩法目前的賠率倍數（四捨五入到小數
  2 位），跟難度分開、互不影響

### 難度共用模組：server/services/game/toys/difficulty.ts

- `scaleWinProbability(baseP, difficulty)`：勝率↔勝敗賠率換算，`difficulty=1` 時完全還原
  `baseP`，結果永遠落在 `(0,1)`
- `resolveFate(difficulty, rng)`：用 `BASE_WIN_P=0.9` 決定這次的目標是贏還是輸
- `resolveWithFate(targetWin, rollOnce, maxTries=40)`：重骰某玩法自己的隨機邏輯（骰子／
  猜拳／抽卡…完全不改），直到結果符合目標，或到達次數上限就接受最後一次
- 8 款玩法各自在 service 檔頂部寫校準依據（例如 pog 反推「5 回合至少 3 勝 ≈90%」對應
  每回合基準機率 0.75；`cards.ts` 的「相同」猜法因天然機率是 0%，用較低基準機率 0.15
  加上直接覆寫抽到的牌，見該檔案註解）
  - 注意：玩法自己的 API 回應（例如 `outcome`/`reward` 欄位）仍反映「原始判定結果」，
    不會因為難度攔截而改寫；只有實際寫入 wallet 帳本的金額會是 0（已知取捨，見 proposal
    UI/UX 風險）

## 6. Token Mapping（Figma 對應）

- 本變更為既有後台頁面的區塊擴充，沿用頁面既有 token（`admin-panel`／`admin-table`／
  `admin-input`／`admin-btn-primary`），不涉入新的 spacing/color/typography 定義

## 7. 錯誤處理與可觀測性

- loading / success / error state 定義：
  - `toyShop.status`：`idle → loading → success/error`（初次載入設定）
  - 開關切換／賠率編輯：各自獨立的 `togglePending`／`editError`，不影響整頁 `status`
- 使用者提示方式（UI message）：
  - 開關切換失敗：沿用既有 `admin-empty` 錯誤文字樣式
  - 賠率編輯失敗：inline 顯示在編輯列旁（比照 `games.vue` 的 `state.editError`）
- 錯誤回傳或 state 落點：所有後端驗證錯誤都回 `createError({ statusCode, message })`，前端
  一律讀 `err.data.message` 顯示，不吞錯

## 8. 測試與驗證策略

- 單元/整合測試範圍：無自動化測試框架（沿用專案現況，`scripts/test-*.mjs` 是手動 node 腳本，
  本變更不新增）
- 手動測試案例：
  1. 後台開關關閉 → 任一柑仔店玩法 API 直接 curl 下注 → 應回 403
  2. 後台開關開啟 → 下注恢復成功
  3. 後台把某玩法賠率設為 2 → 用 admin 測試工具或真實下注觸發中獎 → 確認入帳金額為
     「原始派彩 × 2」
  4. 前台貨架頁：開關關閉時柑仔店櫥仔區塊應整塊隱藏，且不可點進玩法
  5. 後台把單一玩法下架 → 該玩法從 `GET /api/games/toys/catalog` 的 `items` 消失、該玩法
     `roll` 回 403，其他玩法不受影響；重新上架後兩者皆恢復
  6. 用模擬腳本連續呼叫每款玩法的 roll API（100~400 局），統計中獎率與回饋率，確認難度=1、
     賠率=1 的預設狀態下落在「大多數會贏、不會整包吃掉」區間
  7. 把某玩法難度從 1 調到 5，重新跑模擬，確認中獎率明顯下降且接近
     `scaleWinProbability(0.9, 5)` 的理論值（驗證難度真的接進機率本身，不是事後蓋結果）
- 回歸風險與檢查點：確認「經典遊戲」既有 coin 常數編輯功能、「彩運來」既有中獎明細/玩法明細
  報表皆不受影響
