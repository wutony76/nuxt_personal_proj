---
alwaysApply: true
---

# Skill: Naming Logic Enforcer

## Description

負責執行專案命名規範，核心目標為「去冗餘化」與「語意清晰」。確保檔案名稱簡潔，不與父資料夾名稱重複，並維持一致的變數與組件風格。

## Triggers

- 建立新檔案、目錄或組件時。
- 使用者要求「重構」、「清理專案」或「優化目錄結構」時。
- Agent 在掃描現有檔案發現命名存在冗餘時，應主動提出建議。

## Constraints & Standards

### 1. 檔案去冗餘邏輯 (File De-duplication)

- **核心原則**：當檔案位於具備明確語意的資料夾內時，檔名**絕對不可重複**資料夾的名稱。
- **規則範例**：
  - ❌ `employees/EmployeeLeaveView.vue` -> ✅ `employees/LeaveView.vue`
  - ❌ `views/admin/employees/EmployeeRosterView.vue` -> ✅ `views/admin/employees/RosterView.vue`
  - ❌ `auth/AuthLogin.vue` -> ✅ `auth/Login.vue`
  - ❌ `products/ProductDetail.vue` -> ✅ `products/Detail.vue`

### 2. 重構與更名行動 (Refactoring Actions)

- **主動偵測**：若發現冗餘命名（如 `EmployeeGroupsView.vue`），**必須**主動詢問使用者是否簡化。
- **同步更新**：執行更名時，必須同時自動更新專案中所有相關的 `import` 路徑，確保程式碼編譯成功。

### 3. 組件與頁面後綴

- **頁面級組件**：必須帶有 `View` 或 `Page` 後綴 (如: `LeaveView.vue`)。
- **結構性核心組件**：主要入口容器應帶有 `Main` 後綴 (如: `TabsMain`, `NavbarMain`)。
- **功能性原子組件 (如按鈕)**：採用 `[類別][動作]` 結構。
  - **按鈕類**：統一使用 `Btn` 前綴 (如: `BtnAdd`, `BtnSave`, `BtnCancel`)。
- **命名格式**：必須使用 **PascalCase**。

### 4. 變數與函數規範

- **Boolean**: 必須以 `is`, `has`, `can`, `should` 開頭。
- **API 請求**: 函數名稱必須以 `fetch` (讀取) 或 `sync` (同步/更新) 開頭。
- **私有方法/變數**: 必須以底線 `_` 開頭。
- **命名格式**: 必須使用 **camelCase**。
- **長命名去冗餘**：若語意已由檔案/模組上下文提供，命名需縮短為核心詞，避免重複前綴。
  - ❌ `LhcOfficialOrderStatus` -> ✅ `Status`
  - ❌ `WatchOfficialOrdersInput` -> ✅ `WatchInput`
  - ❌ `fetchOfficialOrders` -> ✅ `fetchOrders`

## Examples

#### 情境：建立新檔案

- **User**: "在 orders 資料夾下建立一個訂單列表頁面"
- **AI Action**: 建立 `orders/ListView.vue` (而非 `OrderListView.vue`)。

#### 情境：重構建議

- **User**: "幫我檢查一下這個目錄的命名"
- **AI Action**: 「偵測到 `employees/EmployeeRosterView.vue`，建議更名為 `RosterView.vue` 以符合去冗餘規範。」

#### 情境：變數定義

- **User**: "定義一個判斷是否登入的變數"
- **AI Action**: `const isLoggedIn = false;`

#### 情境：型別命名精簡

- **User**: "這個 composable 內的型別名稱太長，請精簡"
- **AI Action**: 將 `LhcOfficialOrderStatus`、`WatchOfficialOrdersInput` 分別調整為 `Status`、`WatchInput`，並同步更新所有引用。
