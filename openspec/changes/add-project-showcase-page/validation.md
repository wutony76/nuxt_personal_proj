# Validation

## 驗證範圍

- 對應變更：add-project-showcase-page（第二輪：Engineering Portfolio 重新設計）
- 驗證環境：本機既有 dev server（`localhost:6100`，使用者原本已啟動的既有 process，未另開新 port）

## 功能驗證

- [x] 四個路由皆正常回應：
  - `curl http://localhost:6100/project` → `200`
  - `curl http://localhost:6100/project/happyfatyoyo-platform` → `200`
  - `curl http://localhost:6100/project/happyfatyoyo-platform-know-how` → `200`
  - `curl http://localhost:6100/project/happy-fish-3D` → `200`（本輪未變動，仍正常）
- [x] 列表頁內容：`grep -o "PROJECTS|3D歡樂捕魚|HAPPYFATYOYO WORLD|View Project"` 四個關鍵字皆命中
- [x] 案例頁 9 段標題：`grep -o "Overview|Problem|Solution|Key Features|Architecture|Engineering Evidence|Know-how|Tech Stack|Result"` 9 個全數命中
- [x] 案例頁內容區塊：`BG 彩票`/`彩運來`/`遊戲中心`/`柑仔店櫥仔`/`後台管理`（Feature Card）、
  `BG LOTTERY`/`RETRO GAMES`（Metrics）、`View Research`/`View Architecture`/`View Decision Log`/
  `View all engineering notes`（Know-how 精選連結）皆命中
- [x] Know-how 附頁：`Research`/`Decision Log`/`API Data Modeling`/`Why Monthly Reports`/
  `Why this API structure` 皆命中，確認完整 11 項內容都在附頁
- [x] 錨點一致性：案例頁三個「→ View」連結 href 分別為
  `.../happyfatyoyo-platform-know-how#research`／`#architecture`／`#decision-log`，
  附頁對應 `id="research"`／`id="architecture"`／`id="decision-log"` 三個都存在，一一對應
- [x] `npx nuxi typecheck`：搜尋輸出中 `app/pages/project`／`app/components/project`／
  `app/config/projects`／`app/types/project`／`useProjectFonts` 皆零命中，確認本次變更沒有新增
  任何型別錯誤（既有的 149 個錯誤都與本次改動的檔案無關，是本來就存在的問題）

## 內容準確性覆核（H.9 重新驗證）

- 舊版 Result 數字（15 盤口／8 玩法／26 遊戲／8 玩具）標記過未逐一覆核。本輪重新執行實際計數：
  - `BG_GAMES.length` = 15（不變）
  - `TW_GAMES.length` = 8（不變）
  - `RETRO_GAMES.length` = **30**（原文件記載 26 是舊資料，實際已成長到 30 款，已修正）
  - `TOY_CATALOG.length` = 8（不變）
  - `openspec/changes/*`（不含 archive 本身）= 52 份（不變）
- 已同步更新 `app/config/projects/happyfatyoyoPlatform.ts` 的 `keyFeatures`／`result.metrics` 為
  正確數字（30 款經典/像素小遊戲）

## 視覺驗證

- 無 Figma 稿，比照既有站內慣例 + 本輪核准的規劃文件（`.project-scope` token、Space Grotesk +
  JetBrains Mono、9 段各自搭配 Feature Card/Architecture Diagram/Evidence Card/Know-how
  Highlights/Metrics Card 的視覺處理）
- 響應式：卡片格線與 Feature/Evidence/Metrics 格線在 700px（3→2 欄）、480px（2→1 欄）收斂，
  未逐一用瀏覽器截圖驗證各斷點（風險低，沿用同一套 grid class）

## 回歸驗證

- `AppTopbar.vue`、`app/pages/project/happy-fish-3D.vue` 本輪未變動，仍可正常訪問
- `nuxt.config.ts` 只新增一個 css 檔案路徑，未動既有的 `admin.scss`/`base.scss` 註冊

## 問題與修正紀錄

- 問題：WebFetch 無法取得 `https://wutony76.github.io/#/project` 的實際渲染內容（第一輪已記錄，
  非本輪新問題）
- 問題：Result 數字未逐一覆核 —— 本輪已用實測數字修正（見上「內容準確性覆核」），`RETRO_GAMES`
  數量與舊文件不符，已同步更新內容與此文件

## 第三輪：文案語氣統一（更專業感）

使用者親自把 `openspec/project.md` 的 Purpose 改成更專業的產品/工程定位描述後，要求同步調整站內相關
文案，把「個人練習與展示」這類自謙用語換成跟該定位一致的專業語氣：

- `app/config/projects/happyfatyoyoPlatform.ts` 的 `overview`／`problem`：拿掉「個人全端練習與展示
  專案」「個人練習專案」，改為「基於多年累積的全端開發經驗」「獨立打造一套產品等級的系統」等語氣
- `app/pages/project/index.vue` 的 `tagline`（HappyFatYoYo 卡片）與列表頁副標題：拿掉「練習專案」
  「紀錄練習與展示過的成品」，改為「全端彩票 / 遊戲 / 後台自動化工程作品」「展示具備完整產品架構與
  業務邏輯的實作成果」
- `docs/Architecture/README.md`（內部架構筆記，非使用者導覽內容）：「練習與展示用途」→「個人作品集
  展示用途」，維持原意（誠實揭露 `routeRules` 未使用的範圍限制），只是換掉自謙用字
- 全站重新 `grep` 確認「個人.*練習」「練習與展示」「練習專案」三個關鍵字已無殘留
- 用既有 dev server 驗證 `/project`、`/project/happyfatyoyo-platform` 仍回 200，新文案確實渲染
  （`全端工程作品集`、`基於多年累積的全端開發經驗`、`獨立打造一套產品等級的系統` 皆命中）

## 第四輪：加入身分定位聲明

使用者要求把「Senior Frontend / Full Stack Engineer Portfolio」這個定位明確加進來：

- `app/pages/project/index.vue`：hero 區塊在 `PROJECTS` eyebrow 與「專案」標題之間新增一行
  `.np-proj-role`，顯示 `Senior Frontend / Full Stack Engineer Portfolio`
- `app/assets/style/project.scss`：新增 `.np-proj-role`（等寬字體、`--proj-muted` 色）
- `openspec/project.md`：`Product Overview` 新增 `Positioning` 欄位，記錄同一句定位聲明 + 一句話說明
  （不是 UI/Behance 作品集，目標是展示 Frontend Architecture／Full Stack Development／Domain
  Modeling／Engineering Decision 等工程深度）
- 驗證：`curl http://localhost:6100/project` 回 200，`grep -o "Senior Frontend / Full Stack Engineer Portfolio"` 命中

## 第五輪：專案名稱更名

使用者要求把第二個專案的顯示名稱「HappyFatYoYo 彩票遊戲平台」改為「HAPPYFATYOYO WORLD」（呼應
`openspec/project.md` 裡已手動改過的 package 別名 `HappyFatYoYo-World`）：

- 全站 `grep` 找出 6 個出現點：`app/config/projects/happyfatyoyoPlatform.ts`（doc 註解）、
  `app/pages/project/index.vue`（卡片 `name`）、`app/pages/project/happyfatyoyo-platform.vue`
  （`<h1>` 標題）、`app/pages/project/happyfatyoyo-platform-know-how.vue`（返回連結文字 + 附頁副標題）、
  `openspec/changes/add-project-showcase-page/{proposal,validation}.md`
- 只換顯示名稱文字，**不動** route slug（`happyfatyoyo-platform`）與檔名，避免破壞既有連結
- 附頁副標題原本中文名稱後面沒有空格直接接「完整的」，換成全大寫英文名稱後補一個空格
  （`HAPPYFATYOYO WORLD 完整的...`），避免英文字母跟中文字黏在一起
- 驗證：三個路由（`/project`、`/project/happyfatyoyo-platform`、
  `/project/happyfatyoyo-platform-know-how`）皆回 200，`grep -o "HAPPYFATYOYO WORLD"` 在三頁皆命中，
  全站重新確認「HappyFatYoYo 彩票遊戲平台」舊名稱零殘留

## 第六輪：加強 05 Architecture 架構圖

原本的架構圖只是一列 5 個方塊橫排（Browser → app/ → server/api → server/services → Storage），
使用者要求補上更完整的架構圖，改成由上而下堆疊的分層方塊圖，並真實反映路由命名空間與 domain
services 的分支結構：

- `app/types/project.ts`：`ArchitectureContent` 從 `{ nodes, edges, notes }`（單一線性鏈）改成
  `{ layers: ArchitectureLayer[], notes }`，`ArchitectureLayer = { label, nodes }`——同一層內可以有
  多個平行 node，不必再靠 `edges` 反推排序
- `app/config/projects/happyfatyoyoPlatform.ts`：架構圖改成 5 層——Client（Browser）→ Nuxt App（
  `app/`）→ Nitro API（`server/api/`，依實際存在的 4 個路由命名空間分支：`/lottery`、`/lottery-tw`、
  `/games`、`/admin`，皆已用 `find server/api -maxdepth 1 -type d` 核對過真的存在）→ Domain Services
  （`server/services/`，依 `game/lottery/bg`、`game/lottery/tw`、`game/retro`、`game/toys`、`admin`
  五個實際目錄分支，同樣核對過 `server/services/game` 底下的真實子目錄）→ Storage（記憶體）
- `app/components/project/section/ArchitectureDiagram.vue`：改成渲染 `layers`，每層一個 label + 一列
  平行 node，層與層之間用 `↓` 連接，不再需要依 `edges` 自動排序
- `app/assets/style/project.scss`：`.np-proj-arch-diagram`/`.np-proj-arch-arrow` 換成
  `.np-proj-arch`/`.np-proj-arch-layer(-label)`/`.np-proj-arch-row`/`.np-proj-arch-down`，
  `.np-proj-arch-node` 沿用
- 驗證：`curl http://localhost:6100/project/happyfatyoyo-platform`（`200`），`grep` 確認 5 層 label
  與所有 node 皆正確渲染（含 API 4 個路由分支、Service 5 個 domain 分支）；`nuxi typecheck` 對
  `app/types/project`／`app/config/projects`／`app/components/project` 零新增錯誤

## 第七輪：調整列表頁排序

使用者要求把「HAPPYFATYOYO WORLD」排到第一個。調整 `app/pages/project/index.vue` 的 `PROJECTS`
陣列順序與 `no` 欄位：`happyfatyoyo-platform` 變成 `no: '01'`（陣列第一筆），`happy-fish-3D` 變成
`no: '02'`（陣列第二筆）。驗證：`curl http://localhost:6100/project` 回 `200`，HTML 裡
`href="/project/happyfatyoyo-platform"` 的卡片先於 `href="/project/happy-fish-3D"` 出現，
且兩張卡片的 `.np-card-index` 分別渲染為 `01`／`02`。

## 第八輪：擴充列表順序，新增 8 個佔位專案

使用者給了完整的 10 項專案排序清單，其中 8 項（搶頭香（宮廟）、HOT虛擬攝影棚、ACE女神娛樂城、超激
對決娛樂城、PARTY GAME、彩票綜合包網、MT4 GAC、礦機平台）目前站內尚無任何內容，僅有名稱。為了讓
列表頁排序能完整對上、且不出現點擊 404 的卡片，新增這 8 個佔位詳細頁（比照 `happy-fish-3D.vue` 的
簡易 3 段結構：簡介／項目重點／技術棧，內容皆標示「待補」，不臆測任何具體規格）：

- `app/pages/project/index.vue`：`PROJECTS` 陣列補上 8 筆 `ProjectSummary`（`no: '03'`~`'10'`），
  `tagline` 僅依專案名稱本身透露的資訊寫一句話（例如 `MT4 GAC` 沿用名稱裡「行情資料串接與投資試算」），
  沒有任何額外杜撰的具體功能或數字；`techStack` 一律 `['待補']`
- 新增 8 個詳細頁（`app/pages/project/{qiang-tou-xiang,hot-virtual-studio,ace-goddess-casino,
  extreme-showdown-casino,party-game,lottery-white-label,mt4-gac,mining-platform}.vue`），統一用
  `ProjectBackLink`／`ProjectStatusBadge`／`ProjectTagList` + `.project-scope` 共用樣式（比第一輪的
  `happy-fish-3D.vue` 更乾淨，不再各自複製 `<style scoped>`）
- `app/assets/style/project.scss`：把原本重複寫在 `happy-fish-3D.vue`／`happyfatyoyo-platform.vue`
  裡的 `.np-proj-detail-head` 提升為共用 class，新增 `.np-proj-simple-section`（簡易版 3 段式的區塊
  間距），供這 8 個新頁面共用
- 驗證：10 個路由（`/project` + 9 個詳細頁）皆回 `200`；`curl http://localhost:6100/project` 解析
  `href` 順序確認 10 張卡片排序與使用者要求的清單完全一致；`nuxi typecheck` 對
  `app/pages/project`／`app/components/project` 零新增錯誤
- 已知限制：這 8 個新專案除了名稱與（若名稱本身帶說明）一句話 tagline 之外，完全沒有真實內容，
  年份／技術棧／簡介皆為「待補」，等待使用者提供實際資料後再依 `happyfatyoyo-platform` 或
  `happy-fish-3D` 的模式擴寫

## 第九輪：新增「2D.3D美術」專案

使用者要求再加入一項 2D/3D 美術相關專案（呼應使用者手動改過的列表頁副標題，副標題已提到
「結合 2D／3D 美術與遊戲開發經驗」）。卡片名稱最終由使用者手動調整為「2D.3D美術」（我原本寫的是
「2D／3D 美術」），已同步把詳細頁標題改成一致的「2D.3D美術」：

- `app/pages/project/index.vue`：`PROJECTS` 補上第 11 筆（`no: '11'`，`slug: '2d-3d-art'`），比照
  前一輪 8 個佔位專案的做法，`tagline`／`techStack`／`year` 皆標示待補
- 新增 `app/pages/project/2d-3d-art.vue`：同一套簡易 3 段佔位詳細頁模板
- 驗證：`/project` 與 `/project/2d-3d-art` 皆回 `200`，列表頁 `href` 順序確認新卡片排在第 11（最後）

## 結論

- 是否通過：通過
- 已知限制或風險：
  - `happy-fish-3D.vue` 仍是簡易 3 段草稿，未套用本輪的 9 段 schema／新元件（使用者確認的既定範圍）
  - `07 Know-how` 的 `highlights`（哪 6 條被選為精選）是這次的編輯判斷，不是使用者逐條核准的結果，
    若使用者對選擇有意見可直接調整 `app/config/projects/happyfatyoyoPlatform.ts` 的 `highlights` 陣列
  - Engineering Evidence 的 `refLabel` 目前是純文字路徑標籤，未做可點擊連結（依使用者決策）
  - Result 段落無 chart.js 視覺化（依使用者決策，數字為一次性計數非時間序列）
- 後續追蹤事項：
  - 若之後新增更多專案項目，評估是否要把 `happy-fish-3D.vue` 也升級成同一套 schema/元件
  - 若之後遊戲/盤口/玩法數量再變動，`app/config/projects/happyfatyoyoPlatform.ts` 的
    `keyFeatures`／`result.metrics` 需要同步更新
