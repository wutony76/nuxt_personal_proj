# Design

> 本次變更為純 SCSS 檔案結構重組（建置設定層級），不涉及頁面/元件/State/API 開發，
> 下方沿用專案 design 範本的段落標題，非適用段落標記 N/A；額外補上「0. 檔案結構設計」
> 說明實際搬移方式。

## 0. 檔案結構設計（本次變更核心）

### 0.1 目標結構（7-1 pattern，依專案實況裁剪）

```
app/assets/style/
├── main.scss                 # 唯一 manifest，只做 @use，不寫任何實際規則
├── abstracts/
│   └── _variables.scss       # 原 base.scss 的 :root { --xxx } 全域 CSS 變數
├── vendors/
│   └── _fonts.scss           # 原本分散在 base.scss／taiwan_lottery.scss 的
│                              # Google Fonts @import url()
├── base/
│   └── _global.scss          # 原 base.scss 的 .lottery-scrollbar／body／.base .main
└── themes/
    ├── lottery/
    │   ├── _index.scss       # forward 本資料夾內全部 partial（原 base.scss 的
    │   │                      # @use lhc_*.scss 清單搬來這裡）
    │   ├── _lhc-of.scss       # 原 lhc_of.scss
    │   ├── _lhc-cd.scss       # 原 lhc_cd.scss
    │   ├── _lhc-k3.scss       # 原 lhc_k3.scss
    │   ├── _lhc-pk10.scss     # 原 lhc_pk10.scss
    │   ├── _lhc-ssc.scss      # 原 lhc_ssc.scss
    │   ├── _lhc-x5.scss       # 原 lhc_x5.scss
    │   ├── _lhc-eggs.scss     # 原 lhc_eggs.scss
    │   ├── _lhc-kl10.scss     # 原 lhc_kl10.scss
    │   ├── _lhc-kl8.scss      # 原 lhc_kl8.scss
    │   ├── _lhc-fc3d.scss     # 原 lhc_fc3d.scss
    │   ├── _lhc-pl3.scss      # 原 lhc_pl3.scss
    │   └── _taiwan-lottery.scss # 原 taiwan_lottery.scss（拿掉檔內的 @import url，
    │                              # 搬去 vendors/_fonts.scss）
    ├── admin/
    │   └── _admin.scss        # 原 admin.scss，內容不動
    └── project/
        └── _project.scss      # 原 project.scss（1343 行），內容不動，只搬檔＋更名
```

### 0.2 main.scss 內容（維持與原 `css` 陣列等價的 source order）

```scss
@use "vendors/fonts";
@use "abstracts/variables";
@use "base/global";
@use "themes/lottery";
@use "themes/admin";
@use "themes/project";
```

原本 `nuxt.config.ts` 的 4 個入口 `[base.scss, main.css, admin.scss, project.scss]`
收斂為 2 個：`[main.scss, main.css]`。`main.css`（Tailwind entry）維持獨立 —
Tailwind 走 `@layer base`，non-layered 規則（本次搬移的全部內容）本來就優先於
`@layer` 規則，跟它擺在陣列哪個位置無關，因此拆分成 2 個入口不影響 cascade 結果。

### 0.3 更名規則

- 原本沒有底線前綴、底線分隔（`lhc_of.scss`）→ 改成 Sass partial 慣例的
  `_` 前綴 + kebab-case（`_lhc-of.scss`），檔名不影響 `@use` 解析（Sass 對
  `@use "themes/lottery/lhc-of"` 或 `@use "themes/lottery/_lhc-of"` 一視同仁）
- `themes/lottery/_index.scss` 沿用 Sass 慣例：資料夾底下有 `_index.scss` 時，
  `@use "themes/lottery"` 可直接指向該資料夾

### 0.4 跨檔相依性檢查

已用 `grep` 確認現有 15 個 scss 檔案彼此之間**沒有** Sass 變數（`$x`）／
`@mixin`／`@function`／`@include` 相依，全部是 CSS custom properties
（`var(--x)`）與純巢狀選擇器。表示搬移只是改變檔案位置與 `@use` 鏈路，
不涉及任何 Sass 模組作用域調整，風險集中在「路徑寫錯」與「順序」兩點，
已在 [[proposal]] 的風險段落列出對策。

## 1. Layout Structure（頁面結構）

N/A（無頁面變更）

## 2. Component Breakdown（元件拆分）

N/A（無元件變更，僅同步更新既有元件內註解提及的檔案路徑，見 tasks.md）

## 3. State 設計

N/A

## 4. Interaction Flow（click / actions / _handlers）

N/A

## 5. API Contract（JSDoc 必填）

N/A

## 6. Token Mapping（Figma 對應）

N/A（不調整任何視覺 token，僅搬移承載這些 token 的檔案）

## 7. 錯誤處理與可觀測性

N/A

## 8. 測試與驗證策略

- 手動測試：`npm run dev` 啟動後，逐頁比對搬移前後畫面（見 proposal.md 驗證方式）
- 回歸風險：僅集中在「Sass 編譯是否成功」與「cascade 順序是否等價」兩點，
  已於 0.4 說明排除 Sass 模組作用域風險
