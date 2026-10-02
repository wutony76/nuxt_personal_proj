# Engineering Evidence

## 變更摘要

- 對應變更：`add-ssr-lottery-hall-pools`
- 變更檔案清單：
  - `app/pages/lottery-hall.vue`（修改：彩池首次抓取改 `useAsyncData`、`init()` 移到 setup
    階段同步執行、新增 `withTimeout()`、template 新增 `data-pool-value` 屬性）
  - `app/services/api.ts`（修改：移除裸 `import { $fetch } from 'ofetch'`，改用 Nuxt
    自動注入的全域 `$fetch`）
  - `test/perf-ssr-lottery-hall.mjs`（新增：效能量測腳本）
  - `docs/Engineering Evidence/ssr-performance-log.md`（新增兩列：改造前/改造後數據）
- Commit / PR 參考：（待 commit 後補上 hash）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 佐證附件（截圖 / log / 測試輸出）：
  - SSR HTML 含真實資料（curl 驗證，15 張卡片節錄）：
    ```
    data-pool-value="6HC-OF" ...>2,301,430
    data-pool-value="6HC-CD" ...>621,669
    data-pool-value="K3-OF" ...>652,150
    ... （共 15 筆，皆有正確金額）
    ```
  - 效能量測（`test/perf-ssr-lottery-hall.mjs`，5 次取中位數）：
    ```
    改造前：4526 / 4464 / 4419 / 4417 / 4415 ms  → 中位數 4419ms
    改造後： 682 /  189 /  174 /  215 /  178 ms  → 中位數  189ms
    ```
  - `npm test`：36/36 支既有 `test:*` 腳本全數通過
  - Playwright console 檢查：`networkidle` 後無 hydration/mismatch 相關警告
  - 其他依賴 `api.ts` 的頁面抽查：`/`、`/lottery-hall-taiwan`、`/game-hall`、`/admin`、
    `/login` 皆回應 HTTP 200

## 風險與後續追蹤

- 已知風險：
  - 效能數據僅為本機 dev 環境相對比較，非正式站絕對數字
  - `withTimeout()` 3 秒門檻為經驗值，未來若發現誤判需要調整
- 後續追蹤事項（Open Questions 延伸）：
  - `lottery-hall-taiwan.vue` 的 toy catalog 抓取可比照辦理（本次候選、未做）
  - `app/services/api.ts` 的 SSR 相容性問題已順帶修好，之後任何頁面要做類似的 SSR
    轉換都不會再卡在這個問題上

## 封存前檢查

- [x] validation.md 已完成，結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 確認正常（沿用既有長跑 dev server）
- [x] 效能數據已寫入 `docs/Engineering Evidence/ssr-performance-log.md`，以歷史列表形式呈現
- [ ] 尚未 commit——等使用者確認後再建立 commit
