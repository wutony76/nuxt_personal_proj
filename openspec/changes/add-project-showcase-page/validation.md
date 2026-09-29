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
