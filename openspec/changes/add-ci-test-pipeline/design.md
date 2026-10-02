# Design

> 本變更是 CI/工程基礎設施，不是前端頁面功能，模板裡的 Layout/Component/Token Mapping
> 等前端專屬段落不適用，以下僅保留與本次變更相關的段落並改寫內容。

## 1. 整體流程

```
push / PR → main
  │
  ├─ job: build   （既有，不動）checkout → setup-node → npm ci → npm run build
  │
  └─ job: test    （新增）checkout → setup-node → npm ci
                    → 背景啟動 dev server（nohup + curl 輪詢就緒，最長等 60 秒）
                    → npm test（= node scripts/ci-test-all.mjs）
                       → 動態讀 package.json，抓出所有 `test:` 開頭的 script
                       → 依序 spawn 每一支（child process，繼承 stdio）
                       → 彙總 pass/fail，任何一支失敗 → process.exitCode = 1
                    → 失敗時額外印出 dev-server.log 方便排查
```

`build` 與 `test`是兩個互相獨立的 job（同一個 workflow 檔案內），會平行跑，彼此不共用同一份產物，
符合 `ci-pipeline-plan.md` 第 5 節「依分階段順序，每個 phase 各自一個 job」的既有規劃。

## 2. 為什麼不手刻一份 script 清單

`scripts/test-bg-all.mjs`／`scripts/test-games-all.mjs` 這兩支既有彙總器是「固定列舉」：
各自手動列出它要跑哪幾支子腳本（因為每個彙總器要表達的是「BG 所有盤口」「retro+童玩」這種
有業務意義的分組，列舉本身就是文件）。

但 CI 層的彙總器（`scripts/ci-test-all.mjs`）目的不一樣：它要表達的是「把現在能跑的測試全部跑過」，
這種情境下手動列舉清單只會製造「新增測試但忘記同步更新清單」的風險——這正是本次觸發這整個 CI 任務的
童玩測試腳本壞掉事件的同一種失敗模式（規則/現況不同步，只是這次是「CI 清單」會跟「測試腳本」不同步，
而不是「測試腳本」跟「賠率常數」不同步）。所以 CI 彙總器改用 `Object.keys(require('./package.json').scripts)`
動態過濾 `test:` 開頭的項目，自動涵蓋未來新增的任何測試腳本。

`test:bg`／`test:games` 這兩個業務分組彙總器本身也會被 CI 彙總器當成兩支普通的 `test:*` 項目執行
（即使它們內部又各自呼叫了一批子腳本）——會有一些重複執行（子腳本各自又被單獨列為 `test:xxx` 再跑一次），
但實測整個 `npm test`（36 支）本機只需要 32 秒，重複執行的代價遠低於「漏掉覆蓋範圍」的風險，故意不去重。

## 3. dev server 啟動方式

`npm run dev` 本身不會結束（long-running process），GitHub Actions 的某個 step 若直接 `run: npm run dev`
會卡住整個 job。採用 `nohup npm run dev > dev-server.log 2>&1 &` 讓它在背景執行、脫離目前 shell 的生命週期，
同一個 step 內用 curl 輪詢 `http://localhost:6100/` 直到回應成功或逾時（60 秒）。

同一個 job 的所有 step 共用同一台 CI VM／container，background process 不會因為該 step 的 shell 結束而被殺掉，
所以下一個 step（`npm test`）可以直接打 `localhost:6100`，不需要額外的程序間通訊或 artifact 傳遞。

## 4. 錯誤處理與可觀測性

- dev server 60 秒內沒就緒：把 `dev-server.log` 整份印出來再讓 step 失敗（`exit 1`），方便從 Actions log
  直接看到是不是啟動時噴了例外，而不是只看到一個語焉不詳的「curl 失敗」
- `npm test` 任何一支子腳本失敗：`ci-test-all.mjs` 不會提早中止（每支都是獨立 child process），跑完全部
  36 支才統一印出「✔／✘」清單與總計，讓一次 CI 失敗能看到所有壞掉的地方，而不是修一支、重跑、再發現下一支壞
- 整體 `test` job 失敗時（`if: failure()`）額外印一次 `dev-server.log`，涵蓋「測試過程中 server 本身 crash」
  這種跟個別測試斷言無關的失敗模式

## 5. 測試與驗證策略

- 單元/整合測試範圍：本次變更本身是 CI 管線，沒有新的業務邏輯需要單元測試；驗證重點是「這個管線能不能正確
  找到並執行所有測試」
- 手動測試案例：本機跑 `npm test`，逐一核對印出的清單筆數與 `package.json` 的 `test:*` 項目數一致
- 回歸風險與檢查點：確認新增 `"test"` 這個 key 本身不會被 `startsWith('test:')` 誤抓進自己的執行清單
  （造成無窮遞迴）——`"test"` 沒有冒號後綴，過濾條件天生排除
