# Proposal

## 變更名稱

add-project-showcase-page

## 背景

使用者想在站內導覽列新增一個「專案」入口，展示個人開發的專案作品（參考外部作品集網站
`https://wutony76.github.io/#/project`，但該站為純前端 SPA，WebFetch 無法取得實際渲染內容），
因此改為在站內新建一個獨立的專案展示頁，資料由使用者陸續補齊。

**第二輪疊代（Engineering Portfolio 定位）**：使用者明確定位這是 Senior Frontend / Full Stack
Engineer Portfolio，不是一般 UI/Behance 作品集——專案介紹要能呈現 Problem → Solution →
Architecture → Engineering Evidence → Know-how → Decision 的完整敘事，而非只列功能清單；
且要求「不要讓 9 個 Section 都變成密集文字」，需要 Feature Cards／Architecture Diagram／
Evidence Cards／Metrics／Know-how 精選卡＋展開機制建立視覺層級。這一輪不改變已定案的 9 段
結構順序，而是把「單一 union type + 直式條列」的第一版實作，換成有明確型別、每段各自視覺
處理的第二版。詳細規劃見 `design.md`。

## 目標

- 在 `AppTopbar` 導覽列補上「專案」連結（原本 `AppTopbar.vue:41` 是一個空的 `<div></div>` 佔位）
- 新增 `/project` 專案列表頁與第一個專案的詳細頁 `/project/happy-fish-3D`
- 頁面架構先落地，內容（簡介文字、技術標籤）先用預留文字，之後由使用者補正式文案

## 範圍

- 包含：
  - `app/components/AppTopbar.vue`：把空 `<div></div>` 換成「專案」NuxtLink（`to="/project"`）
  - `app/pages/project/index.vue`：專案列表頁（卡片式），改用 `ProjectSummary` 型別 + `ProjectCard` 元件
  - `app/pages/project/happy-fish-3D.vue`：「3D歡樂捕魚」專案詳細頁，本輪**不變動**（見下）
  - `app/pages/project/happyfatyoyo-platform.vue`：第二個專案項目「HAPPYFATYOYO WORLD」
    詳細頁——內容即這個 Nuxt 專案本身（自我介紹型專案），9 段固定結構
    （01 Overview ~ 09 Result，`07 Know-how` 為精選版）
  - 新增 `app/pages/project/happyfatyoyo-platform-know-how.vue`：Know-how 完整版附頁
  - 新增 `app/types/project.ts`：`ProjectSummary`／`DetailContent` 等結構化型別
  - 新增 `app/config/projects/happyfatyoyoPlatform.ts`：抽出的內容資料（詳細頁與附頁共用）
  - 新增 `app/assets/style/project.scss`（`.project-scope` token + 共用 class）並在 `nuxt.config.ts`
    的 `css` 陣列註冊
  - 新增 `app/composables/useProjectFonts.ts`
  - 新增 `app/components/project/`（`ProjectStatusBadge`／`ProjectTagList`／`ProjectBackLink`／
    `ProjectCard`）與 `app/components/project/section/`（`SectionShell`／`FeatureCardGrid`／
    `ArchitectureDiagram`／`EvidenceCardList`／`KnowHowHighlights`／`KnowHowFull`／`MetricsCardGrid`）
- 不包含：
  - 不對外連結到 `wutony76.github.io`
  - 不建立除「3D歡樂捕魚」「HAPPYFATYOYO WORLD」以外的其他專案項目
  - `happy-fish-3D.vue` 本輪不套用新的 9 段 schema——內容本來就標註為推測草稿，優先度排在
    `happyfatyoyo-platform` 之後（使用者確認）
  - Engineering Evidence 的 repo 路徑不做成可點擊連結（repo 相對路徑，無對外可服務網址）
  - Result 段落不做 chart.js 圖表（現有數字是一次性計數、非時間序列，硬做圖表會像裝飾性假資料）

## 影響面

- 前端路由/頁面：`/project`、`/project/happy-fish-3D`（既有，不變）、`/project/happyfatyoyo-platform`
  （既有，重寫）、`/project/happyfatyoyo-platform-know-how`（新增）
- 前端元件/Composables：`AppTopbar.vue` 導覽項目不變；新增 `project/*` 元件與 `useProjectFonts`
- 後端 API/Services：無
- 設定或常數（`app/config/`）：新增 `app/config/projects/happyfatyoyoPlatform.ts`

## 風險與對策

- 技術風險：
  - 風險：無，純新增頁面與靜態導覽項目，不動既有路由與邏輯
  - 對策：以既有 `app/pages/index.vue` 的版面風格（Tailwind slate/indigo）為準，避免與遊戲大廳的
    Cyberpunk 風格混淆
- UI/UX 風險：
  - 風險：目前內容為預留文字，非最終呈現
  - 對策：頁面結構先確定（卡片列表 → 詳細頁），文案之後可直接替換 `PROJECTS` 常數與詳細頁內文，
    不需再動版面結構

## 驗證方式

- 功能驗證：
  - 使用既有 dev server（port 6100）打 `GET /project`、`GET /project/happy-fish-3D` 應回 200
  - 確認首頁導覽列新增的「專案」連結 `href="/project"` 有正確渲染
  - 確認 `/project` 卡片文字含「3D歡樂捕魚」且連到 `/project/happy-fish-3D`
- 視覺驗證：
  - 無 Figma 稿，比照站內既有頁面（`index.vue`）的 slate/indigo 版型
- 回歸驗證：
  - 確認 `AppTopbar.vue` 既有導覽項目（首頁／彩票／彩運來／遊戲／後台／登入登出）未受影響

## 成功標準

- [x] 功能符合需求且行為正確
- [x] UI 與既有站內風格一致（無 Figma 規格可比對）
- [x] 無新增重大 console / runtime error
- [x] 相關測試或手動驗證完成
