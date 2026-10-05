# Engineering Evidence

## 變更摘要

- 對應變更：首頁（`/`）與專案列表頁（`/project`）加入進場動畫與 hover 效果；第二輪追加更豐富的分層進場效果；第三輪參照 `SAMPLE/Industry/texture/page_texture.html` 加上噪點材質紋理
- 變更檔案清單：
  - `app/composables/useScrollReveal.ts`（`v-reveal` 滾動進場指令；第二輪新增 `variant`（`up`/`left`/`right`/`scale`）支援，可指定進場方向）
  - `app/pages/index.vue`（Hero 區塊載入即播放進場動畫；人像獨立縮放淡入、meta 與 CTA 按鈕群組 stagger；Experience 標題／小標分左右滑入、每筆經歷的年份／內容／描述分批 stagger；Contact 標題／小標與三個聯絡卡片各自 stagger + scale 進場；`<main>` 加上 `pf-main-textured`）
  - `app/pages/project/index.vue`（Header meta／標題／描述分層 stagger 進場；每筆專案列拆成編號（左滑入）／中間內容（下滑入）／右側狀態（右滑入）三段式分層進場；`<main>` 加上 `pf-main-textured`）
  - `app/layouts/portfolio.vue`（新增 `hasTexture` computed，僅在路徑為 `/` 或 `/project` 時對 `<header>`/`<footer>` 加上 `pf-header-textured`/`pf-footer-textured`，其餘頁面—尤其 11 個專案詳細頁—維持原本乾淨版面）
  - `app/assets/style/project.scss`（新增 `pf-reveal-left/right/scale` 方向 modifier、`pf-fade-slide-in-left/right`、`pf-fade-scale-in` 等 keyframes；Hero 人像／meta／CTA 按鈕群組獨立進場動畫；`prefers-reduced-motion` 一併涵蓋新增樣式；`pf-proj-row`／`pf-btn-primary` hover 箭頭位移與文字變色；新增 `.pf-header-textured`/`.pf-footer-textured`（噪點顆粒 + 45°/135° 刻痕線 + 青綠色調漸層）與 `.pf-main-textured`（三層不同尺度噪點 + 暈影 radial-gradient + inset box-shadow）—CSS 內容取自參考檔 `SAMPLE/Industry/texture/page_texture.html` 解碼出的 SVG feTurbulence noise data URI，數值原封不動沿用）
- Commit / PR 參考：`335849b`、`564b118`

## 驗證佐證

- 對應 `validation.md` 結論：本次變更範圍屬純視覺／互動層級（無狀態、無 API），未另外開立完整 OpenSpec change 資料夾，驗證結果直接記錄於此
- 佐證附件（截圖 / log / 測試輸出）：
  - `npx nuxi typecheck`：既有 `server/services/game/toys/*`、`server/services/test.ts` 錯誤與本次改動無關（比對檔名確認無 `index.vue` / `useScrollReveal` 相關錯誤）
  - `npx sass --no-source-map app/assets/style/project.scss /dev/null`：編譯成功、無語法錯誤
  - 使用現有 dev server（`localhost:6100`，未另開新 port）以 `curl` 驗證：
    - `GET /` → `200`
    - `GET /project` → `200`
    - `/` 渲染後 HTML 含 `pf-hero-anim` / `pf-hero-anim-title` / `pf-hero-anim-body`
    - `/project` 渲染後 HTML 含 `pf-hero-anim` / `pf-hero-anim-title` / `pf-hero-anim-body`（第二輪將這三個 class 分派到 header meta／標題／描述三個子元素，取代原本整個 section 單一 fade）
    - `pf-reveal-left` / `pf-reveal-right` / `pf-reveal-scale` 為 `v-reveal` 指令在 `mounted` 時才掛載的 client-only class，SSR 輸出不含屬正常行為（與既有 `pf-reveal` 相同模式）
    - `GET /project/2d-3d-art`（專案詳細頁樣本）→ `200`
    - `/` 與 `/project` 渲染後 HTML 皆含 `pf-header-textured` / `pf-footer-textured` / `pf-main-textured`；`/project/2d-3d-art` 渲染後 HTML **不含**上述三個 class，確認材質僅套用在首頁與專案列表頁、未外溢到專案詳細頁

## 風險與後續追蹤

- 已知風險：
  - `v-reveal` 依賴 `IntersectionObserver`，未做舊瀏覽器 polyfill（專案目前無明確瀏覽器相容需求，暫不處理）
  - 動畫效果未做真實瀏覽器手動視覺確認（僅驗證 HTTP 狀態與 class 掛載），需實際開啟頁面滾動確認觀感
  - 材質紋理以多層 SVG data URI + repeating-linear-gradient 疊加，屬持續重繪的裝飾背景，理論上比純色背景略增繪製成本；在 `.pf-header`/`.pf-footer`（固定高度小區塊）與 `.pf-main`（單層 fixed-size 平舖圖層）影響應可忽略，但未做效能量測
  - `.pf-main-textured` 的 `background-image`/`background-size` 需在 SCSS 原始碼順序上排在 `.pf-main`（其 `background: var(--proj-bg)` 簡寫會重置 background-image 為 none）**之後**，才能正確覆蓋；已將材質區塊放在 `.pf-main` 定義之後，如未來調整檔案順序需留意此耦合
- 後續追蹤事項（Open Questions 延伸）：
  - 若日後專案詳細頁（`/project/<slug>`）也要套用一致的進場動畫或材質，可重用 `useScrollReveal` 與 `.pf-main-textured`/`.pf-header-textured`/`.pf-footer-textured`

## 封存前檢查

- [x] 變更檔案與風險說明已整理完成
- [x] 現有 dev server（6100）已確認頁面正常回應
- [ ] 實機瀏覽確認動畫觀感
- [ ] 本次未建立對應 OpenSpec change 資料夾（純視覺變更，範圍與風險皆低，未走完整 proposal/design/tasks；如需補齊請告知）
