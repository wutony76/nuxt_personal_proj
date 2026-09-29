# Design

> 本文件為第二輪疊代（Engineering Portfolio 定位）後的現況設計。完整分析與規劃過程見規劃階段產出的
> plan（Information Architecture / Component Tree / Data Schema / UI Layout / Content Mapping /
> 實作步驟 / 決策點），本文件記錄最終落地的設計。

## 1. Layout Structure（頁面結構）

- Route / Page：
  - `/project` → `app/pages/project/index.vue`（專案列表）
  - `/project/happy-fish-3D` → `app/pages/project/happy-fish-3D.vue`（簡易 3 段結構，本輪不變動）
  - `/project/happyfatyoyo-platform` → `app/pages/project/happyfatyoyo-platform.vue`（案例頁，9 段
    編號結構：`01 Overview` ~ `09 Result`）
  - `/project/happyfatyoyo-platform-know-how` → `app/pages/project/happyfatyoyo-platform-know-how.vue`
    （Know-how 完整版附頁，同層平面檔名，刻意不用巢狀資料夾避免與同名 `.vue` 檔路由歧義）
- Sections：
  - 列表頁：`AppTopbar` + 標題區 + 卡片格線（`ProjectCard`）
  - 案例頁：`AppTopbar` + 返回連結 + 標題區 + 9 個 `SectionShell` 區塊，每段依內容型態各自搭配對應的
    呈現元件（見 3.）
  - Know-how 附頁：`AppTopbar` + 返回連結（指回案例頁）+ 標題區 + `KnowHowFull`（含 `id` 錨點）
- 「→ View Research/Architecture/Decision Log」導覽機制：案例頁 `07 Know-how` 只顯示 4~8 個精選重點
  （`KnowHowHighlights`），連結指向附頁對應分組的錨點（`#research` / `#architecture` /
  `#decision-log`），區塊底部另有不帶錨點的「View all engineering notes →」。採用「附頁 + 頁內錨點」
  而非純展開/收合（會讓案例頁本身變回文字牆）或逐項獨立頁面（單一 bullet 撐不起一個路由）。
- 響應式斷點策略：卡片格線／Feature-Evidence-Metrics 格線在 `700px`（3→2 欄）與 `480px`（2→1 欄）
  收斂，沿用既有 `max-w-6xl`（列表頁）／`max-w-3xl`（詳細頁、附頁）容器寬度。

## 2. Component Breakdown（元件拆分）

- 新增元件（`app/components/project/`）：
  - `ProjectStatusBadge.vue`（prop `status`）、`ProjectTagList.vue`（prop `tags`）、
    `ProjectBackLink.vue`（prop `to?`/`label?`）——取代原本 3 處重複的 markup
  - `ProjectCard.vue`（prop `project: ProjectSummary`）——列表頁卡片。**型別上就不含 Know-how／
    Architecture 欄位**，這是「列表頁不能出現完整 Know-how/Architecture」的實質保證機制，不只是約定
  - `section/SectionShell.vue`（prop `no`/`title` + default slot）：9 段共用的「編號 + 標題 + 上邊界線」
    外殼
  - `section/FeatureCardGrid.vue`（04 Key Features）、`section/ArchitectureDiagram.vue`（05
    Architecture，純 CSS 分層方塊圖，由上而下堆疊 `layers`，同層內多個 node 平行排列，用來呈現
    Client → Nuxt App → Nitro API（依路由命名空間分支）→ Domain Services（依 bg/tw/retro/toys/admin
    分支）→ Storage 的實際分層與分支結構）、`section/EvidenceCardList.vue`（06
    Engineering Evidence）、`section/KnowHowHighlights.vue`（07 Know-how 案例頁精選版）、
    `section/KnowHowFull.vue`（07 Know-how 附頁完整版，帶 `id` 錨點）、`section/MetricsCardGrid.vue`
    （09 Result，KPI 卡片排版仿 `admin/reports/index.vue` 的「小標籤→大數字→說明」邏輯，不借用其
    class 本身）
- `01 Overview`／`02 Problem`／`03 Solution`／`08 Tech Stack` 維持純 markup 寫在頁面裡（純段落/條列/
  標籤），內容結構不足以撐一個元件
- 既有元件調整：
  - `app/components/AppTopbar.vue`：`line 41` 空 `<div></div>` → `NuxtLink to="/project"`（本輪未變動）
- 非 Vue 元件的共用抽出：
  - `app/composables/useProjectFonts.ts`：3 個頁面共用的 Google Fonts `useHead()` 區塊
  - `app/assets/style/project.scss`：`.project-scope` token（比照 `.admin-scope` 既有模式）+ 共用
    `.np-proj-*` class，在 `nuxt.config.ts` 的 `css` 陣列直接註冊（比照 `admin.scss` 的註冊方式，
    不採 `taiwan_lottery.scss` 那種「被 base.scss `@use` 進去」的間接方式，因為 project 頁面是獨立
    範圍，不需要跟全站 base token 混在一起）
  - `app/config/projects/happyfatyoyoPlatform.ts`：`DetailContent` 資料實體，供案例頁與 Know-how
    附頁共用同一份，避免內容重複維護
- 職責與邊界：
  - 列表頁只負責渲染 `ProjectSummary[]`，不做資料抓取
  - 案例頁與附頁都是純靜態內容（無非同步請求），`happy-fish-3D.vue` 暫不套用此輪的元件/型別

## 3. State 設計

### local state（單一 reactive 為主）

- 本次頁面純展示、無互動狀態、無非同步請求，因此不建立 `reactive state`／`_actions`／`click`
- 唯一的私有邏輯是 `happyfatyoyo-platform.vue` 裡把「架構規範：」這類前綴粗體化的
  `_handlers.splitPrefix()`（純字串處理，符合專案「私有邏輯集中在具名私有物件」的規範）
- 之後若專案改為從後端 API 取得，需依規範補上 `state`（`idle/loading/success/error`）與 `_actions.fetch`

### global state（Pinia setup store）

- 不涉及，無跨頁共用狀態需求

## 4. Interaction Flow（click / actions / _handlers）

- 目前無按鈕點擊行為；卡片、View 連結、返回連結都是 `NuxtLink`，導覽交由 Nuxt Router 處理
- `_handlers.splitPrefix()`：純函式，輸入一段字串、依「：」切成 `{prefix, rest}` 供模板分別套用
  `<strong>` 樣式，不吞錯、不做非同步

## 5. API Contract（JSDoc 必填）

- 無 API 呼叫（本次為靜態內容頁）

## 6. Token Mapping（色彩/字體策略）

- 新增 `.project-scope`（`app/assets/style/project.scss`），比照 `.admin-scope`（`app/assets/style/
  admin.scss`）的既有模式，獨立一組 token，不與全站 `base.scss`／`taiwan_lottery.scss` 的 token 混用：
  - `--proj-ink` / `--proj-muted` / `--proj-muted-soft` / `--proj-line` / `--proj-wash`
  - `--proj-accent`（indigo）/ `--proj-accent-soft`
  - `--proj-status-{live,building,archived}-{fg,bg}`
  - `--proj-font-heading: 'Space Grotesk'` / `--proj-font-mono: 'JetBrains Mono'`
- 字體維持 V2 已確定的方向：`Space Grotesk`（標題）+ `JetBrains Mono`（標籤/等寬），透過
  `useProjectFonts()` 統一掛載，不套用遊戲大廳的 Cyberpunk 風格

## 7. 錯誤處理與可觀測性

- 無非同步流程，不適用 loading/success/error 三段狀態
- 無使用者輸入，不需錯誤提示

## 8. Data Schema（`app/types/project.ts`）

以「每段一個明確型別欄位」取代第一版的 `string | string[] | KnowHowGroup[]` union +
`_handlers.isGroupList()` 型別守衛：

```ts
type ProjectStatus = 'live' | 'building' | 'archived'

type ProjectSummary = {           // 列表頁 —— 型別上就不含 Know-how/Architecture
  slug: string; no: string; name: string; tagline: string
  year: string; status: ProjectStatus; techStack: string[]
}

type FeatureCard = { title: string; description: string }

type ArchitectureNode = { id: string; label: string; detail?: string }
/** 一層架構（由上而下堆疊），同一層內的 nodes 是平行關係（例如四個 domain services） */
type ArchitectureLayer = { label: string; nodes: ArchitectureNode[] }
type ArchitectureContent = { layers: ArchitectureLayer[]; notes: string[] }

type EvidenceCard = { title: string; description: string; refLabel?: string; refHref?: string }

type KnowHowItem = { title: string; synopsis?: string }
type KnowHowGroup = {
  key: 'research' | 'architecture' | 'decision-log'
  title: string
  highlights: KnowHowItem[]      // 案例頁只渲染這個（4~8 項）
  full: KnowHowItem[]            // 附頁渲染完整版
}

type MetricCard = { label: string; value: string; caption: string }

type DetailContent = {
  slug: string; overview: string; problem: string; solution: string[]
  keyFeatures: FeatureCard[]; architecture: ArchitectureContent
  engineeringEvidence: EvidenceCard[]; knowHow: KnowHowGroup[]     // 固定 3 組
  techStack: string[]; result: { metrics: MetricCard[]; summary: string }
  knowHowOverflowPath?: string
}
```

## 9. 測試與驗證策略

- 單元/整合測試範圍：無自動化測試（沿用既有慣例）
- 手動測試案例：
  - `/project`、`/project/happyfatyoyo-platform`、`/project/happyfatyoyo-platform-know-how`、
    `/project/happy-fish-3D` 皆回 200
  - 案例頁 9 段標題與各 section 元件渲染的關鍵內容（Feature 標題、Metrics 數字、Know-how 精選項目）
    可用 curl + grep 命中
  - Know-how 精選卡的「→ View X」連結 `href` 與附頁對應 `id` 錨點一致
  - `nuxi typecheck` 不因本次變更新增任何錯誤
- 回歸風險與檢查點：確認 `AppTopbar.vue`、`happy-fish-3D.vue` 未被誤動
