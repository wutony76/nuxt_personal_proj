# Tasks

## 1. 排查範圍

- [x] 修完 bingo 後，搜尋其餘 TW 台彩遊戲 service 檔案是否有同樣的
      `this.drawAt`／`this.cutoffAt` 模式
- [x] 確認 `d539.ts`／`dlt.ts`／`m539.ts`／`m649.ts`／`p3.ts`／`p4.ts`／
      `superlotto.ts` 這 7 個檔案的 `_attemptSettlement()` 都有完全相同的
      `_nextDrawWindow(new Date(this.drawAt + 60_000))` 模式
- [x] 跟使用者確認（`AskUserQuestion`）：一併修正這 7 款

## 2. 修正

- [x] 7 個檔案都改成 `_nextDrawWindow(now)`，並補上跟 `bingo.ts` 一致的
      註解說明根因與對應的修正紀錄

## 3. 驗證

- [x] `npm run test:{d539,dlt,m539,m649,p3,p4,superlotto}`：全數通過
- [x] `npm test`（36 支既有測試腳本）：第一次執行時 `test:6hc-cd`／
      `test:6hc-of`／`test:bg` 失敗，單獨重跑皆全數通過，確認是本次改動
      （7 個檔案同時變更）觸發 Nitro dev 重啟、跟 dev-only 自動測試電池
      撞期的既有 transient 現象，與本次改動的邏輯正確性無關（同一類現象
      在修 bingo 時也遇過一次）

## 4. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/fix-tw-lottery-stuck-settlement-clock-drift.md`
