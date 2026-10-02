# Validation

## 驗證範圍

- 對應變更：`add-ci-test-pipeline`
- 驗證環境：本機 dev server（`http://localhost:6100`，既有長跑的 dev server，非另開新 port）

## 功能驗證

- 依 proposal 的「成功標準」逐項驗證：
  - [x] `npm test` 本機執行，36 支 `test:*` 腳本全數通過 — 實際結果：
    ```
    共 36 支，成功 36 支，失敗 0 支
    npm test  9.77s user 2.11s system 36% cpu 32.417 total
    ```
  - [x] `.github/workflows/ci.yml` 新增的 `test` job 語法正確 — 實際結果：
    `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"` 輸出 `YAML OK`
  - [x] 新增測試腳本不需要同步修改 CI 設定 — 實際結果：程式碼走讀確認 `ci-test-all.mjs` 用
    `Object.keys(pkg.scripts).filter(name => name.startsWith('test:'))` 動態抓取，沒有任何寫死的腳本清單；
    `"test"` 這個 key 本身因為沒有冒號後綴不會被過濾條件抓進去，不會自我遞迴
  - [ ] 實際 push 到 GitHub 後，Actions 上的 `test` job 真的跑出綠燈 — 待實際 push 後確認（見下方「結論」）

## 視覺驗證

- 不適用（CI 管線變更，無 UI）

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：既有 `build` job（`npm run build`）
  - 結果：`ci.yml` 只新增一個獨立 `test` job，`build` job 的內容原封不動，未受影響
  - 流程：既有 30+ 支個別 `test:xxx` script 的手動執行方式（`npm run test:xxx`）
  - 結果：完全不變，`ci-test-all.mjs` 只是在它們之上多加一層彙總執行，不影響各自獨立執行的用法

## 問題與修正紀錄

- 問題：（本次實作過程未遇到需要修正的問題；`npm test` 第一次本機執行即全數通過）
  - 發現方式：—
  - 修正方式：—
  - 是否已重新驗證：—

## 結論

- 是否通過：**有條件通過** — 本機驗證（功能、語法、回歸）皆已完成且全部正確；
  唯一待確認項目是「實際 push 後 GitHub Actions 是否真的綠燈」，這項只能在 push 之後才能驗證，
  本機無法模擬 GitHub Actions 的執行環境（VM 規格、網路限制等）
- 已知限制或風險：
  - dev server 60 秒啟動逾時是本機經驗估算，CI VM 效能可能不同，若第一次 push 後發現逾時太短，
    需要回來調整 `seq 1 60` 的次數
  - `npm test` 會重複執行 `test:bg`／`test:games` 內部已經跑過的子腳本（見 design.md 第 2 節），
    目前總時間可接受（本機 32 秒），但如果未來測試數量大幅成長、CI 時間變成瓶頸，需要重新評估
    是否要排除這兩個聚合器之一
- 後續追蹤事項：
  - push 後到 GitHub Actions 頁面確認 `test` job 綠燈，若紅燈依 `dev-server.log` 排查
  - 待 CI 穩定跑過幾次後，可以考慮去 GitHub repo Settings → Branches 設定分支保護規則，
    把 `build`／`test` 設成 required status checks（`ci-pipeline-plan.md` 踩雷點⑤，本次不涵蓋）
