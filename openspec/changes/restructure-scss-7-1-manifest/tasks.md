# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（檔案結構設計；其餘頁面/元件段落標記 N/A）
- [x] 確認 15 個既有 scss 檔案無 Sass 變數/mixin/function 跨檔相依

## 2. 建立新資料夾結構

- [x] 建立 `app/assets/style/abstracts/`、`base/`、`vendors/`、`themes/lottery/`、
      `themes/admin/`、`themes/project/`
- [x] `git mv` 搬移並更名 15 個既有檔案到對應資料夾（保留 git 歷史）
- [x] 從 `base.scss` 拆出 `:root { --xxx }` → `abstracts/_variables.scss`
- [x] 從 `base.scss` 拆出 `.lottery-scrollbar`／`body`／`.base .main` →
      `base/_global.scss`
- [x] 從 `base.scss`／`taiwan_lottery.scss` 拆出兩個 Google Fonts
      `@import url()` → `vendors/_fonts.scss`
- [x] 建立 `themes/lottery/_index.scss`，forward 資料夾內 12 個 partial

## 3. 建立 manifest 並更新設定

- [x] 建立 `app/assets/style/main.scss`，依 design.md 0.2 的順序 `@use` 各分類
- [x] 更新 `nuxt.config.ts` 的 `css` 陣列為
      `['~/assets/style/main.scss', '~/assets/css/main.css']`
- [x] 刪除搬移後留在原路徑的舊檔案

## 4. 同步文件與註解

- [x] 更新 `app/components/Dialog.vue`、`app/components/admin/Shell.vue`、
      `app/components/TaiwanLotteryPrizeDialog.vue`、
      `app/components/lottery/tw/dlt/block/DialogOpenCode.vue`、
      `app/components/lottery/tw/dlt/block/DialogUser.vue`、
      `app/components/lottery/bg/k3/block/Controls.vue` 內提及舊路徑的註解
- [x] 更新 `docs/Architecture/README.md` 的 SCSS 段落，補上 7-1 pattern 資料夾說明

## 5. 視覺與互動驗證

- [x] `npm run dev` 確認無 Sass/build 錯誤
- [x] 首頁／`/project`／`/admin`／代表性樂透玩法頁面／`/lottery-hall-taiwan`
      視覺與搬移前一致
- [x] Network 面板確認 Google Fonts 請求仍正常

## 6. 交付檢查

- [x] 確認 `npm run dev` 可正常啟動
- [x] 補齊 `validation.md`、`engineering-evidence.md`
- [x] 變更檔案清單整理完成
