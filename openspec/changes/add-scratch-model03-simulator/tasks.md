# Tasks

## 1. 研究原始 Python 專案

- [x] 確認 9 個 model 的 `.pkl` 資料型別：model01/02/03 是純
      dict/tuple/list/int，model04~09 包了 `BTrees.OOBTree`，皆可解開
      轉成 JSON、不需要重新計算機率
- [x] 跟使用者確認整合方式：在 Nuxt 專案內用 TS 重新實作消費邏輯，不跑
      獨立 Python server、不做 proxy
- [x] 跟使用者確認先做 model03（最簡單）當驗證範本
- [x] 讀 `scratch_model03.py` 的 `get_coin_card()`／`get_play1()`／
      `analyze_card()`／`write_model03()`，完整理解機率表結構與消費流程
- [x] 發現 model03 原始碼「得到金額」只在平手時非零、跟頁面規則文字不
      一致，跟使用者確認忠實移植、不擅自修正

## 2. 資料轉換

- [x] 寫一次性 Python 腳本解開 `data/model03.pkl`，確認型別皆為 plain
      int/tuple/list，轉成 JSON 核對內容
- [x] 把轉出的機率表原封不動寫進
      `server/services/game/scratch/model03Data.ts`（具名 TS 常數，型別化）

## 3. 消費邏輯實作

- [x] `server/services/game/scratch/model03.ts`：`_getCoinCard`／
      `_getPlay1`／`analyzeModel03Card`，忠實移植洗牌/抽牌/輪詢池邏輯
- [x] 模組層級的手勢組合輪詢池（`_rotatingHandPool`），行為對應 Python
      版的 process-wide 單例

## 4. API 與前端

- [x] `server/api/admin/game-simulator/scratch-model03.post.ts`：
      `sessionController.requireAdmin` 保護，驗證 `cardWinCoin`、夾擠
      `count` 到 1~50
- [x] `app/services/api.ts` 新增 `admin.gameSimulator.scratchModel03()`
      與 `ScratchModel03Card`／`ScratchModel03Round` 型別
- [x] `app/pages/admin/game-simulator.vue`：表單（目標金額/張數）＋結果
      顯示（5 局卡片），取代原本的 `AdminComingSoon` 佔位

## 5. 測試

- [x] 新增 `test/test-scratch-model03.mjs`：不合法目標金額拒絕、張數
      夾擠、機率表消費邏輯一致性（150 局樣本驗證 getCoin 只在平手時
      非零）、目標金額 0 的邊界情況
- [x] 測試過程中抓到真實 bug：API 端 `count` 參數用
      `Number(body?.count) || 10` 處理，`0` 是合法但 falsy 的值，被誤判
      成「沒填」蓋成預設值 10；改用 `Number.isFinite()` 判斷修正
- [x] 加進 `package.json` 的 `test:scratch-model03`（`ci-test-all.mjs`
      自動掃描 `test:*` 腳本，不需要額外登記）
- [x] Playwright 開 `/admin/game-simulator`：填表單、送出試算、確認結果
      正確渲染、無 console 錯誤
- [x] `npm test`（38 支測試腳本）：全數通過，執行過程中出現的
      `test:bg` 單次失敗單獨重跑即全過，確認是本次改動觸發 Nitro 重啟、
      跟 dev-only 自動測試電池撞期的既有 transient 現象

## 6. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/add-scratch-model03-simulator.md`
