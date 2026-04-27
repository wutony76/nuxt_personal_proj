# Design

## 1. Layout Structure（頁面結構）

- Route / Page：
- Sections：
- Blocks：
- 響應式斷點策略：

## 2. Component Breakdown（元件拆分）

- 新增元件：
  - `app/components/...`
- 既有元件調整：
  - `app/components/...`
- 職責與邊界：
  - （說明各元件只處理什麼）

## 3. State 設計

### local state（單一 reactive 為主）

- `state`：
- `uiState`（如需）：
- `formState`（如需）：

### global state（Pinia setup store）

- `storeXxx`：
- 讀寫方式（避免解構 store）：

## 4. Interaction Flow（click / actions / _handlers）

- `click.xxx`（UI 入口）：
  - 觸發條件：
  - 轉交 `actions.xxx`：
- `actions.xxx`（流程入口）：
  - loading guard：
  - early return：
  - success flow：
  - error flow：
- `_handlers.xxx`（私有資料轉換）：

## 5. API Contract（JSDoc 必填）

### Endpoint / Service 1

- request schema：
- response schema：
- error cases：

```js
/**
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
```

## 6. Token Mapping（Figma 對應）

- spacing：
- color：
- typography：
- radius / shadow：

## 7. 錯誤處理與可觀測性

- loading / success / error state 定義：
- 使用者提示方式（UI message）：
- 錯誤回傳或 state 落點：

## 8. 測試與驗證策略

- 單元/整合測試範圍：
- 手動測試案例：
- 回歸風險與檢查點：
