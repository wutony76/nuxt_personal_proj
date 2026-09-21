# Design

## 1. Layout Structure（頁面結構）

- Route / Page：`app/pages/admin/taiwan-lottery.vue`（既有頁面，新增區塊，不新增路由）
- Sections：既有「KPI 卡片」「玩法明細」「中獎明細」之後，新增「柑仔店櫥仔設定」
- Blocks：
  - 開關列：目前狀態文字（開放中／暫停中）+ 切換按鈕
  - 賠率表：`admin-table`，8 列（玩法名稱／賠率倍數／動作），列內編輯比照 `games.vue` 的
    coin 常數編輯 UX（點「編輯」→ input 可改→「儲存」/「取消」）
- 響應式斷點策略：沿用頁面既有 `.atl-*` class 慣例，不特別另做斷點（表格本身已可橫向滾動）

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
    editingSlug: null as string | null,
    draftMultiplier: '',
    editError: '',
  })
  ```
- `uiState`：不需要，用上面 `toyShop.editingSlug` 判斷哪一列進入編輯態即可
- `formState`：不需要，賠率編輯只有單一欄位，用 `draftMultiplier` 字串暫存即可

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
  - 進入/退出賠率編輯態，設定 `editingSlug`/`draftMultiplier`
- `actions.saveOdds(row)`
  - loading guard：以 `editingSlug` 是否為該列 slug 判斷是否重複送出
  - early return：`draftMultiplier` 非數字或 < 0 時，設 `editError` 並 return，不送出請求
  - success flow：呼叫 `api.admin.toyShop.setOdds(slug, multiplier)`，成功後更新
    `toyShop.odds` 對應列、清空編輯態
  - error flow：`toyShop.editError` 顯示後端回傳訊息（例如賠率格式錯誤）
- `_handlers`：不需要額外資料轉換，API 回應已是可直接渲染的形狀

## 5. API Contract（JSDoc 必填）

### GET /api/admin/toy-shop/settings

- request schema：無（admin session）
- response schema：`{ enabled: boolean; odds: Array<{ slug: string; name: string; multiplier: number }> }`
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

- request schema：`{ multiplier: number }`
- response schema：`{ slug: string; name: string; multiplier: number }`
- error cases：400（`multiplier` 非數字或 < 0）、404（slug 不存在）、401/403

```ts
/**
 * 後台：設定單一玩法的賠率倍數（套用在實際派彩金額上）
 * @param {string} slug
 * @param {{ multiplier: number }} body
 * @returns {Promise<ToyShopOddsItem>}
 */
```

### GET /api/games/toys/catalog（既有端點，回應補欄位）

- response schema 新增：`enabled: boolean`（柑仔店櫥仔目前是否開放）

### POST /api/games/toys/:slug/roll（既有 8 個端點，行為變更）

- 關閉時：回 403 `{ message: '柑仔店櫥仔目前暫停開放。' }`
- 中獎入帳：`wallet.credit` 的 `amount` 乘上該玩法目前的賠率倍數（四捨五入到小數 2 位）

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
- 回歸風險與檢查點：確認「經典遊戲」既有 coin 常數編輯功能、「彩運來」既有中獎明細/玩法明細
  報表皆不受影響
