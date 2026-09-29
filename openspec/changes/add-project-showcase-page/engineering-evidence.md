# Engineering Evidence

## 變更摘要

- 對應變更：add-project-showcase-page（第二輪：Engineering Portfolio 重新設計）
- 變更檔案清單：
  - `app/components/AppTopbar.vue`（第一輪已修改，本輪未變動）
  - `app/types/project.ts`（新增）
  - `app/assets/style/project.scss`（新增）+ `nuxt.config.ts`（修改：`css` 陣列加一行）
  - `app/composables/useProjectFonts.ts`（新增）
  - `app/config/projects/happyfatyoyoPlatform.ts`（新增：案例頁 + 附頁共用內容資料）
  - `app/components/project/{ProjectStatusBadge,ProjectTagList,ProjectBackLink,ProjectCard}.vue`（新增）
  - `app/components/project/section/{SectionShell,FeatureCardGrid,ArchitectureDiagram,
    EvidenceCardList,KnowHowHighlights,KnowHowFull,MetricsCardGrid}.vue`（新增）
  - `app/pages/project/index.vue`（重寫：改用 `ProjectSummary[]` + `ProjectCard`）
  - `app/pages/project/happyfatyoyo-platform.vue`（重寫：改用 `DetailContent` + 9 段對應元件）
  - `app/pages/project/happyfatyoyo-platform-know-how.vue`（新增：Know-how 完整版附頁）
  - `app/pages/project/happy-fish-3D.vue`（本輪未變動）
  - `openspec/changes/add-project-showcase-page/*.md`（本輪規格文件更新）
- Commit / PR 參考：（尚未 commit，待使用者明確要求）

## 驗證佐證

- 對應 `validation.md` 結論：**通過**
- 佐證附件（截圖 / log / 測試輸出）：
  - `curl` 對 4 個路由（`/project`、`/project/happyfatyoyo-platform`、
    `/project/happyfatyoyo-platform-know-how`、`/project/happy-fish-3D`）皆回 `200`
  - `curl ... | grep -o` 驗證列表頁、案例頁 9 段標題、Feature/Metrics/Know-how 精選內容、附頁完整
    Know-how 內容皆命中（詳見 validation.md）
  - Know-how 「→ View」連結 href 與附頁 `id` 錨點一一對應，人工核對三組皆一致
  - `npx nuxi typecheck`：搜尋本次新增/修改的檔案路徑（`app/pages/project`、
    `app/components/project`、`app/config/projects`、`app/types/project`、`useProjectFonts`）
    於錯誤輸出中零命中，確認未新增型別錯誤
  - Result 數字重新掃描：`RETRO_GAMES.length` 實測為 30（非舊文件記載的 26），已同步更新內容
  - 無另存螢幕截圖檔案

## 風險與後續追蹤

- 已知風險：
  - `happy-fish-3D.vue` 停留在第一輪的簡易 3 段結構，尚未套用本輪的元件/型別體系（使用者確認範圍）
  - `07 Know-how` 的精選項目是本次編輯判斷，非使用者逐條核准；`refLabel`（Engineering Evidence 的
    路徑標籤）非可點擊連結；`09 Result` 無圖表視覺化——三者皆為使用者明確決策後的結果，非疏漏
  - `app/config/projects/happyfatyoyoPlatform.ts` 裡的數字（15/8/30/8/52）是這次的一次性人工計數，
    之後 codebase 持續成長會再度過時，需要下次疊代時重新覆核
- 後續追蹤事項：
  - 若新增第三個專案項目，需要決定是否比照 `happyfatyoyo-platform` 的完整 9 段 schema，或維持
    `happy-fish-3D` 的簡易 3 段草稿
  - 若使用者對 Know-how 精選項目的選擇有不同意見，直接調整
    `app/config/projects/happyfatyoyoPlatform.ts` 的 `highlights` 陣列即可，不需要動元件或型別

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev`（既有 dev server）+ 手動路由驗證已確認正常
- [ ] 可執行 `openspec archive`（待使用者確認是否要封存這個持續疊代中的 change，或繼續留在
      active 狀態供下一輪疊代使用）
