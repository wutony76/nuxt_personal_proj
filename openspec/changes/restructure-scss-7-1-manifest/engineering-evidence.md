# Engineering Evidence

## 變更摘要

- 對應變更：restructure-scss-7-1-manifest — SCSS 依 7-1 pattern 重整為單一 main.scss manifest
- 變更檔案清單：
  - 新增：`app/assets/style/main.scss`、`app/assets/style/abstracts/_variables.scss`、
    `app/assets/style/base/_global.scss`、`app/assets/style/vendors/_fonts.scss`、
    `app/assets/style/themes/lottery/_index.scss`
  - 搬移＋更名（`git mv`，內容不變）：
    - `app/assets/style/lhc_of.scss` → `app/assets/style/themes/lottery/_lhc-of.scss`
    - `app/assets/style/lhc_cd.scss` → `app/assets/style/themes/lottery/_lhc-cd.scss`
    - `app/assets/style/lhc_k3.scss` → `app/assets/style/themes/lottery/_lhc-k3.scss`
    - `app/assets/style/lhc_pk10.scss` → `app/assets/style/themes/lottery/_lhc-pk10.scss`
    - `app/assets/style/lhc_ssc.scss` → `app/assets/style/themes/lottery/_lhc-ssc.scss`
    - `app/assets/style/lhc_x5.scss` → `app/assets/style/themes/lottery/_lhc-x5.scss`
    - `app/assets/style/lhc_eggs.scss` → `app/assets/style/themes/lottery/_lhc-eggs.scss`
    - `app/assets/style/lhc_kl10.scss` → `app/assets/style/themes/lottery/_lhc-kl10.scss`
    - `app/assets/style/lhc_kl8.scss` → `app/assets/style/themes/lottery/_lhc-kl8.scss`
    - `app/assets/style/lhc_fc3d.scss` → `app/assets/style/themes/lottery/_lhc-fc3d.scss`
    - `app/assets/style/lhc_pl3.scss` → `app/assets/style/themes/lottery/_lhc-pl3.scss`
    - `app/assets/style/taiwan_lottery.scss` → `app/assets/style/themes/lottery/_taiwan-lottery.scss`
      （另拆出檔內 Google Fonts `@import url()` 至 `vendors/_fonts.scss`）
    - `app/assets/style/admin.scss` → `app/assets/style/themes/admin/_admin.scss`
    - `app/assets/style/project.scss` → `app/assets/style/themes/project/_project.scss`
  - 拆分：`app/assets/style/base.scss`（已刪除）拆為
    `abstracts/_variables.scss`（`:root` 變數）＋
    `base/_global.scss`（`.lottery-scrollbar`／`body`／`.base .main`）＋
    `vendors/_fonts.scss`（Google Fonts import）
  - 設定調整：`nuxt.config.ts`（`css` 陣列 4 項 → 2 項）
  - 註解同步：`app/components/Dialog.vue`、`app/components/admin/Shell.vue`、
    `app/components/TaiwanLotteryPrizeDialog.vue`、
    `app/components/lottery/tw/dlt/block/DialogOpenCode.vue`、
    `app/components/lottery/tw/dlt/block/DialogUser.vue`、
    `app/components/lottery/bg/k3/block/Controls.vue`
  - 架構文件：`docs/Architecture/README.md`（新增「app/assets/style/ 樣式結構」段落，
    更新 SCSS 規範描述與最後更新日期）
- Commit / PR 參考：（尚未提交，待使用者確認後由使用者指示是否建立 commit）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 佐證附件（截圖 / log / 測試輸出）：
  - `npx sass --load-path=app/assets/style app/assets/style/main.scss` 編譯零錯誤，
    輸出 2409 行 CSS、393 個頂層選擇器（僅存於本次 session 執行紀錄，未落地檔案）
  - `curl` 對 `/`、`/project`、`/admin`、`/lottery/bg/6hc-of`、`/lottery-hall-taiwan`、
    `/lottery/tw/dlt` 皆回應 200
  - `.output/public/_nuxt/entry.Coa_m1Es.css` 既有 build 產物證實 `@import url()`
    會被 build pipeline 自動提升到 bundle 最前面，作為「搬移字型 import 不影響
    載入順序」的佐證

## 風險與後續追蹤

- 已知風險：
  - `themes/project/_project.scss`（1343 行）尚未依內部區塊再拆更細的 partial，
    單檔仍偏大
- 後續追蹤事項（Open Questions 延伸）：
  - 未來新增樂透玩法時，掛載目標從「`base.scss` manifest」改為
    「`themes/lottery/_index.scss`」，既有 OpenSpec 文件（如
    `openspec/changes/add-kl8/tasks.md`）內提及舊路徑的措辭屬於歷史紀錄，
    不需回頭修改，但之後撰寫新 change 文件時應改用新路徑
  - 若後續要再拆 `_project.scss`，建議另開一個 change 處理，避免與本次
    純檔案結構重組的變更範圍混在一起

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev`（既有 6100 進程）已確認正常，代表頁面皆 200
- [ ] 可執行 `openspec archive`（待使用者確認變更內容後再封存）
