# Proposal

## 變更名稱

restructure-scss-7-1-manifest — SCSS 依 7-1 pattern 重整為單一 main.scss manifest

## 背景

`docs/Architecture/README.md`／`openspec/project.md` 規範 Style 層要用 SCSS + `@use`/`@forward`，
精神上比照 7-1 pattern（單一 manifest 統一 forward 各分類 partial）。但目前 `nuxt.config.ts` 是
四個平行入口：

```
css: ['~/assets/style/base.scss', '~/assets/css/main.css', '~/assets/style/admin.scss', '~/assets/style/project.scss'],
```

`base.scss` 本身又混雜兩種職責：一是「全域 CSS 變數／捲軸樣式／body 基礎樣式」，二是
`@use` 11 個 `lhc_*.scss` + `taiwan_lottery.scss` 幫這些樂透玩法 partial 做 forwarding——
既是內容檔又兼 manifest，跟 7-1 pattern「manifest 只做 forward，不寫實際樣式」的角色不符。
規範與實作不一致。

## 目標

- 建立單一 SCSS manifest（`app/assets/style/main.scss`），依 7-1 pattern 分類至
  `abstracts/`／`base/`／`vendors/`／`themes/` 資料夾
- `nuxt.config.ts` 的 `css` 陣列從 4 個入口收斂成 2 個（`main.scss` + Tailwind 的 `main.css`）
- 全程不改變任何一條 CSS 規則的內容、選擇器或 CSS 變數值，也不改變最終 cascade 順序，
  純粹是檔案位置與 import 鏈路的重組

## 範圍

- 包含：
  - 新增 `app/assets/style/main.scss` 作為唯一 manifest
  - 新增資料夾：`abstracts/`（全域 CSS 變數）、`base/`（body／捲軸等基礎樣式）、
    `vendors/`（Google Fonts `@import url()`）、`themes/lottery/`（原 11 個 `lhc_*.scss` +
    `taiwan_lottery.scss`）、`themes/admin/`（原 `admin.scss`）、`themes/project/`（原 `project.scss`）
  - 搬移並更名上述既有檔案（加上 `_` partial 前綴、統一 kebab-case）
  - 更新 `nuxt.config.ts` 的 `css` 陣列
  - 同步更新程式碼中引用舊路徑的註解（`Dialog.vue`／`admin/Shell.vue`／
    `TaiwanLotteryPrizeDialog.vue`／`DialogOpenCode.vue`／`DialogUser.vue`／`Controls.vue`）
- 不包含：
  - 不更動任何 CSS 規則、選擇器、CSS 變數值
  - 不動 `app/assets/css/main.css`（Tailwind entry，走獨立的 PostCSS 管線，non-layered 規則
    優先權天生高於 `@layer base`，維持獨立入口不影響 cascade）
  - 不處理 `project.scss`（1343 行）內部是否要再拆成更細的 partial——先維持單一檔案搬移，
    降低這次重組的風險面

## 影響面

- 前端路由/頁面：無（純樣式檔案位置調整）
- 前端元件/Composables：無邏輯變動，僅少數元件內註解提及的檔案路徑需同步更新
- 後端 API/Services：無
- 設定或常數（`app/config/`）：無；僅 `nuxt.config.ts` 的 `css` 陣列

## 風險與對策

- 技術風險：
  - 風險：搬移／更名檔案後 `@use` 相對路徑寫錯，導致 build 失敗或某個玩法樣式消失
  - 對策：搬移後立即 `npm run dev`／`build` 驗證編譯成功；逐一比對 `.lottery-6hc-of` 等
    scope class 是否仍出現在編譯後 CSS 內
  - 風險：manifest 內 `@use` 順序與原本 4 個入口的 source order 不一致，改變 cascade
    （例如 admin 樣式蓋掉 project 樣式）
  - 對策：manifest 內維持與原陣列一致的相對順序（base 內容 → admin → project），且各檔案
    彼此都是不同 scope class（`.lottery-*`／`.admin-scope`／`.project-scope`），互不重疊，
    順序調整實務上不影響視覺
- UI/UX 風險：
  - 風險：Google Fonts `@import url()` 搬到 `vendors/_fonts.scss` 後，若 Sass 編譯把它排到
    非開頭位置，可能被瀏覽器忽略
  - 對策：實測目前 build 產物（Vite/PostCSS）本來就會自動把所有 `@import url()` 提升到
    bundle 最前面（已用 `.output/public/_nuxt/entry.*.css` 驗證過現況），搬檔不影響這個行為

## 驗證方式

- 功能驗證：
  - `npm run dev` 正常啟動，無 Sass 編譯錯誤
  - 打開首頁／`/project`／`/admin`／`/lottery/bg/6hc-of`／`/lottery-hall-taiwan`
    等代表性頁面，畫面與搬移前一致（截圖或肉眼比對）
- 視覺驗證：
  - 比對搬移前後編譯出的 CSS（`.output` 或 dev 的樣式輸出）規則數量與內容一致，
    只有位置／檔名差異
- 回歸驗證：
  - 確認 Google Fonts 仍正確載入（Network 面板可見 `fonts.googleapis.com` 請求）
  - 確認 `.lottery-scrollbar`／`:root` CSS 變數等全域樣式仍生效

## 成功標準

- [ ] `nuxt.config.ts` 的 `css` 陣列只剩 `main.scss` + `main.css` 兩項
- [ ] `app/assets/style/` 依 7-1 pattern 分類到位，`main.scss` 為唯一 manifest
- [ ] 所有頁面視覺與搬移前一致，無新增 console / build error
- [ ] 相關程式碼註解中的舊路徑已同步更新
