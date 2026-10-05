# Tasks

## 1. 排查現況

- [x] 派 Explore agent 確認根因：`_allowedGamesOf()` 第一次存取時預設全選
      所有已支援遊戲（約 61 款），`autoCreateMember()` 沒有做任何初始化，
      20 個 NPC 共用同一組全域權重，彼此行為完全一致
- [x] 確認「資料統計／會員」頁（`members.get.ts`）確實以 NPC 活動作為
      這個 demo 環境的主要統計來源，印證「NPC 行為太單調 → 每款遊戲人數
      分布不自然」這個因果關係
- [x] 確認既有基礎設施（`NpcMemberSetting`／`allowedGames`／
      `NpcGamePreset`）已支援個別 NPC 差異化，只是從未在建立當下套用過

## 2. 設計與實作

- [x] 新增 `NpcArchetype` 型別與 `NPC_ARCHETYPES`（5 種原型：BG 彩迷、
      復古遊戲宅、台彩鐵粉、柑仔店熟客、雜食玩家），各自定義分類權重與
      「該分類勾選遊戲數佔比」區間
- [x] 新增 `_pickArchetype()`（加權隨機抽原型）、`_shuffled()`
      （Fisher-Yates 洗牌）、`_randomSharePick()`（在百分比區間內隨機擲
      一個值、從洗牌後的清單取對應數量）
- [x] 新增 `_assignArchetype(userId)`：組出這個 NPC 的 `allowedGames`、
      覆寫分類權重並整份存回 `_memberSettings`
- [x] `autoCreateMember()` 建立會員後呼叫 `_assignArchetype(user.id)`

## 3. 驗證

- [x] 重啟 Nitro（程式碼變更觸發）後，查 `/api/admin/npc/settings`
      確認 20 個 NPC 的 `allowedGames.length`（10~23 款不等）、四個分類
      權重皆有明顯差異，沒有任何一個 NPC 是全選 61 款
- [x] Playwright 開 `/admin/npc`：面板正常渲染每個 NPC 不同的「X 款」
      標籤，無 console 錯誤
- [x] `npm test`（37 支既有測試腳本）：全數通過

## 4. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/fix-npc-game-diversity.md`
