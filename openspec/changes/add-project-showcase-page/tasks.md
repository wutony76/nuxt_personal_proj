# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（Engineering Portfolio 定位、範圍/風險/驗證方式）
- [x] 完成 design 定稿（Component Tree / Data Schema / UI Layout / Know-how 附頁決策）
- [x] 與使用者確認關鍵決策（Know-how 導覽機制、色彩 token 策略、Result 是否要圖表、Engineering
      Evidence 連結、Key Features 內容刪減、Result 數字覆核、`happy-fish-3D` 範圍）

## 2. 型別與樣式基礎

- [x] 新增 `app/types/project.ts`（`ProjectSummary`/`DetailContent` 等型別）
- [x] 新增 `app/assets/style/project.scss`（`.project-scope` token + 共用 `.np-proj-*` class），
      在 `nuxt.config.ts` 的 `css` 陣列註冊
- [x] 新增 `app/composables/useProjectFonts.ts`

## 3. 前端元件

- [x] 建立共用元件：`ProjectStatusBadge`/`ProjectTagList`/`ProjectBackLink`/`ProjectCard`
- [x] 建立 section 元件：`SectionShell`/`FeatureCardGrid`/`ArchitectureDiagram`/`EvidenceCardList`/
      `KnowHowHighlights`/`KnowHowFull`/`MetricsCardGrid`
- [x] 依規範用具名匯入（比照 `k3-cd.vue` 的既有慣例），不依賴 Nuxt 巢狀資料夾自動命名前綴

## 4. 頁面重寫

- [x] `app/pages/project/index.vue` 改用 `ProjectSummary[]` + `ProjectCard`
- [x] `app/pages/project/happyfatyoyo-platform.vue` 改用 `DetailContent` + 9 段對應元件
- [x] 新增 `app/pages/project/happyfatyoyo-platform-know-how.vue`（Know-how 完整版附頁）
- [x] `app/pages/project/happy-fish-3D.vue` 本輪不變動（使用者確認）

## 5. 內容確認與重新覆核

- [x] Result 段落 4 個數字重新掃描一次（`RETRO_GAMES.length` 實測為 30，非舊文件記載的 26，已修正）
- [x] Key Features 拿掉逐一列出遊戲/玩法名稱的括號清單，改一行精簡描述
- [x] Know-how 精選 6 項（Research/Architecture/Decision Log 各 2 項），完整 11 項全數保留在附頁

## 6. 驗證

- [x] 用既有 dev server（6100）確認 4 個路由皆回 200
- [x] 用 curl + grep 確認 9 段標題、Feature/Metrics/Know-how 精選內容、View 連結與附頁錨點一致
- [x] `nuxi typecheck` 確認無新增錯誤
- [x] 更新 `validation.md`、`engineering-evidence.md`

## 7. 交付檢查

- [x] 變更檔案與風險說明整理完成
- [ ] 全程未 commit（待使用者明確要求）
