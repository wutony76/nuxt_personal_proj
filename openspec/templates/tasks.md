# Tasks

## 1. 規格與設計確認

- [ ] 完成 proposal 定稿（範圍/風險/驗證方式）
- [ ] 完成 design 定稿（state/flow/API/token mapping）
- [ ] 完成 Figma 對照清單

## 2. 前端頁面與元件

- [ ] 建立或調整頁面（`app/pages/...`）
- [ ] 建立或調整元件（`app/components/...`）
- [ ] 依規範實作 `click` 入口

## 3. 狀態與流程

- [ ] 實作 composable（`app/composables/useXxx`）
- [ ] 建立 `state` 與必要 `uiState/formState`
- [ ] 實作 `actions`（含 loading guard + early return）
- [ ] 補齊 `_handlers` 私有邏輯

## 4. API 與服務

- [ ] 建立或調整前端 API wrapper（`app/services/api.ts`）
- [ ] 建立或調整 server route（`server/api/...`）
- [ ] 建立或調整 server service（`server/services/...`）
- [ ] 補齊 API request/response JSDoc 或型別註記

## 5. 錯誤處理與體驗

- [ ] 每個 async flow 都有 loading / success / error
- [ ] 錯誤訊息可被 UI 感知，不吞錯
- [ ] 高頻事件補上 debounce/throttle（如適用）

## 6. 視覺與互動驗證

- [ ] UI 與 Figma 對齊（layout/component/token/interaction）
- [ ] 響應式版型檢查（主要斷點）
- [ ] 主要操作流程端到端手動驗證

## 7. 交付檢查

- [ ] 確認 `npm run dev` 可正常啟動
- [ ] 必要時執行 build / preview 驗證
- [ ] 變更檔案與風險說明整理完成
