# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（流程/動態發現機制/dev server 啟動方式/錯誤處理）
- [x] Figma 對照清單 — 不適用（CI 管線，無 UI）

## 2. CI 測試彙總器

- [x] 新增 `test/ci-test-all.mjs`：動態讀 `package.json`、過濾 `test:` 開頭的 script、依序 spawn 執行
- [x] 彙總結果輸出（✔/✘ 清單 + 總計），任何一支失敗 `process.exitCode = 1`
- [x] `package.json` 新增 `"test"` script 指到這支彙總器

## 3. GitHub Actions workflow

- [x] `.github/workflows/ci.yml` 新增 `test` job（獨立於既有 `build` job）
- [x] dev server 背景啟動（`nohup` + curl 輪詢就緒，逾時印 log 並失敗）
- [x] 失敗時印出 `dev-server.log`（`if: failure()`）
- [x] YAML 語法驗證（`python3 -c "import yaml; yaml.safe_load(...)"`）

## 4. 驗證

- [x] 本機 `npm test` 執行，確認全部 `test:*` 腳本（36 支）通過
- [x] 確認新增/修改測試腳本不需要同步改這個 workflow 檔案（程式碼走讀：無寫死清單）
- [ ] 實際 push 到 GitHub，確認 Actions 上 `test` job 顯示綠燈（需要實際 push，不在本機可驗證範圍）

## 5. 交付檢查

- [x] 確認 `npm run dev` 仍可正常啟動（沒有動到既有 dev server 設定）
- [x] 變更檔案與風險說明整理完成（見 proposal.md「影響面」「風險與對策」）
- [ ] push 後於 GitHub Actions 頁面確認 `test` job 實際執行結果
