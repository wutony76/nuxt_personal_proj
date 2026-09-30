# Design

## 1. Layout Structure（頁面結構）

- Route / Page：不新增頁面，`/admin/**` 全站生效（透過共用 `AdminShell`）
- Sections：`Shell.vue` 新增一條「DEMO 模式」橫幅（`status==='ok' && isDemo` 時顯示，
  位置比照既有 `.ash-notice`）
- Blocks：`Shell.vue` 的 `<slot />`（頁面主體內容）改包一層
  `<fieldset :disabled="isDemo">`；頁首導覽／登出／回首頁維持在 fieldset 外，
  不受影響
- 響應式斷點策略：沿用既有 `.ash-*` 樣式，不新增斷點

## 2. Component Breakdown（元件拆分）

- 既有元件調整：
  - `app/components/admin/Shell.vue`：唯讀橫幅 + fieldset 包裹
  - `app/components/admin/RoleList.vue`：角色設定新增「DEMO 模式」開關列
    （比照既有 `測試模式`／`NPC模式` 開關的 pattern，`demo` 角色鎖定不可關）
- 職責與邊界：
  - `Shell.vue` 只負責「唯讀模式的視覺提示與 UI 層擋操作」，不做任何權限判斷邏輯
    （判斷結果完全來自 `useAdminAuth()`）
  - 實際「能不能存取」「能不能寫入」的判斷全部在後端，前端只是把後端已經算好的
    `isAdmin`／`isDemo` 拿來決定要不要渲染/擋 UI

## 3. State 設計

### local state（單一 reactive 為主）

- `useAdminAuth.ts` 的既有單例 `state` 物件新增一個欄位：`isDemo: boolean`
  （不新增第二個 reactive，維持原本「一次 GET /api/admin/me，其他頁面共用」的設計）

### global state（Pinia setup store）

- 不涉及，這條資訊本來就走 `useAdminAuth` 單例 reactive，不需要 Pinia

## 4. Interaction Flow（click / actions / _handlers）

- `RoleList.vue` 新增：
  - `click.toggleDemoMode`（UI 入口）：
    - 觸發條件：點擊 DEMO 模式開關按鈕，且目前選取角色不是鎖定角色
    - 轉交 `_actions.updateSettings('demoMode', { demoMode: !selected.value.demoMode })`
      （沿用既有 `updateSettings` action，不需要新增）
- `Shell.vue` 不新增 actions，`isDemo` 純粹是 computed 出來的顯示邏輯

## 5. API Contract（JSDoc 必填）

### `GET /api/admin/me`（既有端點，回應多一個欄位）

```js
/**
 * @returns {Promise<{ isAdmin: boolean, isDemo: boolean, user: AuthUser }>}
 */
```

### `PATCH /api/admin/role-defs/:id/settings`（既有端點，body 多一個欄位）

```js
/**
 * @param {Object} body
 * @param {boolean} [body.demoMode]
 * @returns {Promise<{ role: RoleDef }>}
 */
```

- error cases：
  - `id === 'demo'` 且 `patch.demoMode === false` → 400「Demo 角色的唯讀模式固定為開啟，不可關閉。」
    （比照既有 `npc` 角色鎖定 testMode/npcMode 的寫法）
  - 呼叫者不是白名單 admin → 40003（`requireAdmin` 不變，demo 帳號本身就打不了這支）

### 新增：`sessionController.requireAdminView(event)`（不是 HTTP 端點，是共用的 server 端 helper）

```js
/**
 * 允許白名單 admin 或 demoMode 角色通過；只給「唯讀」端點使用，
 * 寫入端點一律繼續用 requireAdmin（白名單限定）。
 * @param {H3Event} event
 * @returns {AuthUser}
 * @throws 40001 未登入 / 40003 accessLevel 為 'none'
 */
```

## 6. Token Mapping（Figma 對應）

- 無新視覺稿，DEMO 橫幅沿用 `.ash-notice` 既有配色（`--wash`／`--muted`／`--line`），
  只換文案與（可選）強調色

## 7. 錯誤處理與可觀測性

- `requireAdminView` 未通過：沿用既有 40003 error code 慣例，`Shell.vue` 的
  `status==='denied'` 畫面文案需同步更新（目前寫死「此帳號不在管理員白名單內」，
  改成同時涵蓋「不在白名單、也沒有 demo 存取權」的情境）
- 寫入端點被 demo 帳號呼叫：沿用既有 `requireAdmin` 的 40003，不需新增錯誤碼；
  前端因為已用 `fieldset disabled` 擋掉觸發入口，理論上不會真的打到這些端點，
  這條路徑純粹是後端防線

## 8. 測試與驗證策略

- 手動測試：見 proposal.md 的「驗證方式」
- 回歸風險：
  - 15 支 GET 端點改動全部是「同一行文字替換」（`requireAdmin` → `requireAdminView`），
    用 grep 逐一核對，避免漏改或改錯到 POST/PATCH/PUT/DELETE 端點
  - `me.get.ts` 回應多一個欄位，需確認 `useAdminAuth.ts` 的 catch 分支（401 時）
    也正確重置 `isDemo`
