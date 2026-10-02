# Proposal

## 變更名稱

`add-ci-test-pipeline` — CI 自動跑完所有 `test/test-*.mjs`（OpenSpec CI 建置計劃 Phase 5）

## 背景

`openspec/reference/ci-pipeline-plan.md` 在 2026-08-27 規劃了 5 階段 CI 導入順序，Phase 1（`npm run build`）
已上線（見 `.github/workflows/ci.yml`、commit `c177d9a`）。Phase 5（自動化測試）當時明訂「目前零測試，
先讓 CI 準備好『有測試就會跑』，不要為了填格子硬寫假測試」——刻意擱置。

現在專案已經累積 30+ 支 `test/test-*.mjs`（涵蓋台彩 8 款玩法、BG 15 個盤口、retro 遊戲中心 30 款、
復古童玩 8 款、後台角色/權限 RBAC、WebSocket 聊天室），且本次 session 另外發現並修好了 8 支童玩測試
腳本因為先前 `feat(toy-shop)` 那次賠率校準 commit 沒有同步更新而全數壞掉、兩週沒人發現的真實案例——
這正是 Phase 5 reference doc 說的「有測試就會跑」的時機已經成熟，且凸顯了沒有 CI 安全網的實際代價。

## 目標

- 每次 push／PR 到 `main`，CI 自動啟動 dev server、跑過全部 `test:*` 腳本，任何一支失敗就讓 CI 顯示紅燈
- 新增測試腳本時不需要回頭修改 CI workflow 檔案（自動被涵蓋），避免重蹈「新增測試但忘記接進檢查」的覆轍

## 範圍

- 包含：
  - 新增 `test/ci-test-all.mjs`：從 `package.json` 動態抓出所有 `test:` 開頭的 script 依序執行、彙總結果
  - `package.json` 新增 `"test"` script（指到上面那支彙總器，符合 `npm test` 慣例）
  - `.github/workflows/ci.yml` 新增 `test` job：啟動 dev server（背景＋curl 輪詢就緒）→ `npm test`
- 不包含：
  - Phase 2（typecheck）／Phase 3（ESLint）／Phase 4（Prettier）——`ci-pipeline-plan.md` 已說明這些各自有
    前置債務要先清，不在本次範圍
  - 不新增任何測試案例本身的業務邏輯（修復既有童玩測試腳本的多項判定錯誤是本次 session 的獨立前置工作，
    已各自以 commit 記錄；這裡只處理「CI 要怎麼跑這些已經存在、已經修好的測試」）
  - 不設定 GitHub repo 的分支保護規則（`ci-pipeline-plan.md` 踩雷點⑤已註明這是網頁操作，不在程式碼變更範圍）

## 影響面

- CI 設定：`.github/workflows/ci.yml` 新增一個 job
- 新增檔案：`test/ci-test-all.mjs`
- 設定或常數：`package.json` 的 `scripts.test`

## 風險與對策

- 技術風險：
  - 風險：dev server 在 CI VM 上啟動時間不可預期，太短的等待會誤判為失敗
  - 對策：curl 輪詢最長等 60 秒，逾時才判定失敗並把 server log 吐出來方便排查
  - 風險：CI 環境跟本機 dev server 狀態不同（本機可能有累積的彩池/角色異動髒資料），可能出現本機過、
    CI 不過的落差
  - 對策：CI 每次都是全新 VM、全新 in-memory `Storage.init()`，反而比本機长时间开着的 dev server 更乾淨；
    已在本機對著既有 dev server 實測 `npm test` 36 支全過，邏輯本身跟「是否全新啟動」無關
- UI/UX 風險：不適用（本次不涉及前端 UI 變更）

## 驗證方式

- 功能驗證：
  - 本機執行 `npm test`，確認動態抓出的 `test:*` 清單完整（逐一比對 `package.json`）且全部通過
  - 確認新增一支 `test:xxx` script 後不需要修改 `ci-test-all.mjs` 或 `ci.yml` 就會被涵蓋（程式碼走讀確認：
    用 `Object.keys(pkg.scripts)` 動態抓取，無寫死清單）
- 視覺驗證：不適用
- 回歸驗證：
  - 確認既有 `build` job 未受影響（`ci.yml` 只新增一個獨立 `test` job，未改動 `build` job 內容）

## 成功標準

- [x] `npm test` 本機執行，36 支 `test:*` 腳本全數通過
- [x] `.github/workflows/ci.yml` 新增的 `test` job 語法正確（YAML 已用 `python3 -c "import yaml..."` 驗證）
- [x] 新增測試腳本不需要同步修改 CI 設定（自動發現機制）
- [ ] 實際 push 到 GitHub 後，Actions 上的 `test` job 真的跑出綠燈（需要實際 push 才能驗證，見 validation.md）
