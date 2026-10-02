# Engineering Evidence

## 變更摘要

- 對應變更：`add-ci-test-pipeline`（落實 `openspec/reference/ci-pipeline-plan.md` Phase 5）
- 變更檔案清單：
  - `scripts/ci-test-all.mjs`（新增）
  - `package.json`（新增 `scripts.test`）
  - `.github/workflows/ci.yml`（新增 `test` job）
- Commit / PR 參考：（待 commit 後補上 hash）

## 驗證佐證

- 對應 `validation.md` 結論：有條件通過（本機驗證全過，GitHub Actions 實跑待 push 後確認）
- 佐證附件（截圖 / log / 測試輸出）：
  - 本機 `npm test` 完整輸出（36/36 通過）：
    ```
    ========================================
    CI 測試彙總結果
    ========================================
      ✔ npm run test:6hc-cd
      ✔ npm run test:6hc-of
      ✔ npm run test:bg
      ✔ npm run test:bingo
      ✔ npm run test:chat
      ✔ npm run test:d539
      ✔ npm run test:dlt
      ✔ npm run test:eggs
      ✔ npm run test:fc3d
      ✔ npm run test:games
      ✔ npm run test:k3-cd
      ✔ npm run test:k3-of
      ✔ npm run test:kl10
      ✔ npm run test:kl8
      ✔ npm run test:m539
      ✔ npm run test:m649
      ✔ npm run test:p3
      ✔ npm run test:p4
      ✔ npm run test:pk10-cd
      ✔ npm run test:pk10-of
      ✔ npm run test:pl3
      ✔ npm run test:retro
      ✔ npm run test:roles
      ✔ npm run test:ssc-cd
      ✔ npm run test:ssc-of
      ✔ npm run test:superlotto
      ✔ npm run test:toy-bamboo-copter
      ✔ npm run test:toy-big-pig
      ✔ npm run test:toy-cards
      ✔ npm run test:toy-gummy
      ✔ npm run test:toy-lucky-draw
      ✔ npm run test:toy-pog
      ✔ npm run test:toy-soda-whistle
      ✔ npm run test:toy-whistle-candy
      ✔ npm run test:x5-cd
      ✔ npm run test:x5-of

    共 36 支，成功 36 支，失敗 0 支
    ```
  - YAML 語法驗證輸出：`YAML OK`

## 風險與後續追蹤

- 已知風險：
  - dev server 啟動逾時門檻（60 秒）是本機經驗值，未在實際 GitHub Actions VM 上驗證過
  - `npm test` 對 `test:bg`／`test:games` 內部子腳本有重複執行（見 design.md 第 2 節的取捨說明），
    已知但判斷可接受（本機 32 秒內跑完 36 支）
- 後續追蹤事項（Open Questions 延伸）：
  - push 後確認 GitHub Actions `test` job 實際執行結果，若 CI VM 上 dev server 啟動較慢需要調整逾時秒數
  - 待 CI 穩定後考慮在 GitHub repo 設定分支保護規則（不在本次變更範圍，見 `ci-pipeline-plan.md` 踩雷點⑤）

## 封存前檢查

- [x] validation.md 已完成，結論為「有條件通過」（本機驗證完整，GitHub Actions 實跑待 push 後確認）
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 確認正常（沿用既有長跑 dev server，未受影響）
- [ ] push 後於 GitHub Actions 確認 `test` job 綠燈，才可視為完全驗證通過並執行 `openspec archive`
