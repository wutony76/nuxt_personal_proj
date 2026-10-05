# Engineering Evidence

## 變更摘要

- 對應變更：`add-ssr-lottery-hall-pools`
- 變更檔案清單：
  - `app/pages/lottery-hall.vue`（修改：彩池首次抓取改 `useAsyncData`（含 `lazy: true`）、
    `init()` 移到 setup 階段同步執行、`watch(initialPools, ...)` 反應式灌值、
    template 新增 `data-pool-value` 屬性）
  - `app/services/api.ts`（修改：移除裸 `import { $fetch } from 'ofetch'`，改用 Nuxt
    自動注入的全域 `$fetch`；24 個彩池/爆池相關函式加上 `{ timeout: 3000 }`）
  - `test/perf-ssr-lottery-hall.mjs`（新增，後改版為同時量測 4 項指標：
    TTFB／首次真實數字／settled／LCP）
  - `docs/Engineering Evidence/ssr-performance-log.md`（新增 4 列：2 列原始量測
    + 2 列 review 後的更正量測）
- Commit / PR 參考：`55e300f`（首版）、`363460a`（review 後修正）、`abca4c5`（補回首次動畫）

## 驗證佐證

- 對應 `validation.md` 結論：通過（含 4 項 review 修正後重新驗證）
- 佐證附件：
  - 更正後效能數據（中位數，5 次樣本）：

    | 指標 | 改造前 | 改造後 |
    |---|---|---|
    | TTFB | 17ms | 20ms |
    | 首次真實數字 | 486ms | 226ms |
    | 完全停止變動 | 4448ms | 226ms |
    | LCP | 296ms | 336ms |

  - `curl` 驗證 SSR HTML 含真實資料（15 張卡片皆有正確金額）
  - `npm test`：36/36 支既有 `test:*` 腳本全數通過（含 api.ts 24 個函式加上 timeout
    後的回歸驗證）
  - Playwright 驗證 client-side 導覽（`lazy: true` 生效）：點擊 `/game-hall` 的真實
    `NuxtLink` 切到 `/lottery-hall`，導覽完成（網址變更）耗時 184ms，資料補齊耗時 329ms，
    無 hydration/mismatch 警告
  - ofetch 內建 `timeout` 的底層行為已讀原始碼確認（`node_modules/ofetch`）：用真正的
    `AbortController` 中止請求，完成時會 `clearTimeout` 自己的計時器

## 風險與後續追蹤

- 已知風險：
  - 效能數據為本機 dev 環境相對比較；TTFB 在本機幾乎無差異（同進程 API），正式環境
    換成較慢服務時 SSR 的 TTFB 代價會更明顯，需要誠實揭露這個取捨
  - `timeout: 3000` 門檻為經驗值，未量測過各函式在不同負載下的真實分布
  - cookie 轉發（`useRequestFetch()`）尚未實際示範，是下一步要處理的獨立風險
- 後續追蹤事項：
  - 挑一個需要登入的報表類頁面，用 `useRequestFetch()` 做第二個 SSR + cookie 轉發示範，
    這才是架構文件原本批評的那類場景（`trend`/`bet_search`）
  - `lottery-hall-taiwan.vue` 的 toy catalog 抓取可比照辦理（候選、本次不做）

## 封存前檢查

- [x] validation.md 已完成，結論為「通過」，含 4 項 review 修正的完整記錄
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 確認正常
- [x] 效能數據已更正並寫入 `ssr-performance-log.md`（保留原始誤導性數據列、標註說明、
      新增更正列，未刪除既有內容）
- [x] Commit：`55e300f`、`363460a`、`abca4c5`
