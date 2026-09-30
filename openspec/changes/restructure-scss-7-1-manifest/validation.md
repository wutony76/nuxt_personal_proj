# Validation

## 驗證範圍

- 對應變更：restructure-scss-7-1-manifest — SCSS 依 7-1 pattern 重整為單一 main.scss manifest
- 驗證環境：本機 dev（既有 `nuxt dev --port 6100` 進程，`nuxt.config.ts` 變更觸發自動重啟）

## 功能驗證

依 proposal 的「成功標準」逐項驗證：

- [x] `nuxt.config.ts` 的 `css` 陣列只剩 `main.scss` + `main.css` 兩項 — 實際結果：
      `css: ['~/assets/style/main.scss', '~/assets/css/main.css']`
- [x] `app/assets/style/` 依 7-1 pattern 分類到位，`main.scss` 為唯一 manifest — 實際結果：
      `abstracts/`／`base/`／`vendors/`／`themes/{lottery,admin,project}/` 建立完成，
      `main.scss` 內只有 6 行 `@use`，無任何實際 CSS 規則
- [x] 所有頁面視覺與搬移前一致，無新增 console / build error — 實際結果：見下方視覺驗證
- [x] 相關程式碼註解中的舊路徑已同步更新 — 實際結果：`Dialog.vue`／`admin/Shell.vue`／
      `TaiwanLotteryPrizeDialog.vue`／`DialogOpenCode.vue`／`DialogUser.vue`／`Controls.vue`
      共 6 處註解已改為新路徑，`grep -rn "assets/style" app server` 確認無殘留舊檔名

## 視覺驗證

- `npx sass --load-path=app/assets/style app/assets/style/main.scss` 直接編譯 manifest：
  無任何 Sass 錯誤，輸出 2409 行、393 個頂層選擇器
- 編譯後 CSS 內 `fonts.googleapis|admin-scope|project-scope|lottery-6hc-of|theme-taiwan-lottery`
  關鍵字共出現 47 次，確認 5 個主題 scope 與 Google Fonts import 皆完整保留（非漏搬移）
- 既有 dev server（`localhost:6100`，`nuxt.config.ts` 修改觸發自動重啟）重啟後，
  以下代表性頁面皆回應 200，且頁面 HTML 內可見對應的 scope class：
  - `/`（home）
  - `/project`（`.project-scope` 主題）
  - `/admin`（`.admin-scope` 主題）
  - `/lottery/bg/6hc-of`（`.lottery-6hc-of` 玩法樣式）
  - `/lottery-hall-taiwan`（`.theme-taiwan-lottery`；HTML 內確認含
    `fonts.googleapis.com/css2?family=Caprasimo&family=...` 字型請求）
  - `/lottery/tw/dlt`（沿用 6hc-of `.report-table` 全域樣式）
- 響應式斷點檢查：本次無調整任何 CSS 規則內容，故不影響既有響應式行為，略過重複檢查

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：Google Fonts 載入（原本分散在 `base.scss`／`taiwan_lottery.scss` 兩處，
    集中到 `vendors/_fonts.scss`）
  - 結果：實測目前 build pipeline（Vite/PostCSS）本來就會把所有 `@import url()`
    自動提升到最終 CSS bundle 最前面（`.output/public/_nuxt/entry.*.css` 內
    `@charset` 後緊接兩個 `@import`），搬檔不影響這個行為；dev 環境頁面 HTML 也
    確認字型請求仍存在
  - 流程：cascade 順序（base → admin → project 的 source order）
  - 結果：15 個既有 scss 檔案彼此皆為不重疊的 scope class（`.lottery-*`／
    `.admin-scope`／`.project-scope`），無 Sass 變數/mixin 跨檔相依，manifest
    內維持與原陣列一致的相對順序，實務上不影響任何視覺結果

## 問題與修正紀錄

- 問題：`nuxt.config.ts` 存檔後，dev server 短暫回應 503（頁面顯示
  「nuxt.config.ts updated. Restarting Nuxt...」）
  - 發現方式：`curl` 輪詢 `localhost:6100` 時發現連續 503
  - 修正方式：非本次變更造成的錯誤，是 Nuxt 偵測到 `nuxt.config.ts` 變更後的
    正常重啟行為；等待約 25 秒重啟完成後恢復 200
  - 是否已重新驗證：是，重啟後所有代表頁面皆回應 200

## 結論

- 是否通過：是
- 已知限制或風險：`themes/project/_project.scss`（1343 行）本次僅搬移＋更名，
  內部段落是否要再拆成更細的 partial 屬於後續優化項目，不在本次範圍內
- 後續追蹤事項：若未來新增樂透玩法，比照既有慣例在 `themes/lottery/` 下新增
  partial 並掛進 `themes/lottery/_index.scss`（取代原本「掛進 `base.scss`
  manifest」的舊慣例，OpenSpec 範本/既有 change 文件內提及 `base.scss manifest`
  的措辭之後可視情況更新為 `themes/lottery/_index.scss`）
