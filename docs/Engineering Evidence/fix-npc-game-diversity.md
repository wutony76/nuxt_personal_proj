# Engineering Evidence：NPC 自動新增差異化遊戲偏好

## 變更摘要

- **對應變更**：`fix-npc-game-diversity`
- **變更檔案**：`server/services/admin/modules/npcAutoPlay.ts`

### 問題

使用者回報：伺服器啟動時建立的 20 個 NPC 全部都玩全部遊戲，導致後台
「資料統計／會員」頁每款遊戲的不重複人數分布不自然地平均，不像真實玩家
會各有偏好。

### 根因

`_allowedGamesOf(userId)` 在某個 NPC 第一次被存取、還沒存過勾選紀錄時，
預設全選所有已支援分類的遊戲（bg／retro／tw／toys 共約 61 款）。
`autoCreateMember()`（server 啟動建立 20 個 NPC 用的函式）建立會員後完全
沒有初始化 `allowedGames` 或各分類權重，20 個 NPC 因此都落到這個「全選」
預設值，且權重也共用同一組全域 `_schedule` 預設值——彼此行為完全一致。

專案裡其實已經有完整的「個別 NPC 自訂」基礎設施（`NpcMemberSetting` 的
四個分類權重、`allowedGames`、遊戲勾選範本），只是從未在「自動新增」這個
時間點套用過，都要管理員事後一個一個手動改。

### 修法

新增 5 種「玩家原型」（BG 彩迷、復古遊戲宅、台彩鐵粉、柑仔店熟客、雜食
玩家），各自定義分類權重與「該分類勾選遊戲數佔比」區間。`autoCreateMember()`
建立會員後呼叫 `_assignArchetype(userId)`：加權隨機抽一個原型，對每個
分類在其佔比區間內隨機擲一個百分比、洗牌後取對應數量的遊戲，寫入
`allowedGames`；原型的分類權重整份覆寫進 `_memberSettings`。同原型的不同
NPC 因為各自重新擲百分比、重新洗牌，實際勾選的遊戲清單也不會完全相同。

## 驗證

| 項目 | 方法 | 結果 |
|---|---|---|
| 差異化確認 | 查 `/api/admin/npc/settings` | 20 個 NPC 的 `allowedGames.length` 分布在 10~23 款，四個分類權重對應 5 種不同原型，不再全部相同 |
| 同原型仍有變化 | 比對同權重組合的 NPC | 例如兩個「復古遊戲宅」NPC 分別勾選 23 款／22 款，具體遊戲清單也不同，確認隨機性有效 |
| 面板渲染 | Playwright 開 `/admin/npc` | 每個 NPC 顯示不同的「X 款」標籤，無 console 錯誤 |
| 回歸測試 | `npm test` | 37/37 全數通過 |

## 風險與後續

- 隨機分派可能導致某些冷門遊戲當月完全沒有 NPC 勾選（統計 0 人）——這更
  貼近真實情況，且管理員隨時可在「NPC 管理」面板手動調整
- 既有管理員手動調整 API（`setMemberGameAllowed`／`setMemberGamesBulk`／
  `saveGamePreset`／`applyGamePreset`／`setMemberSetting`）與面板 UI
  完全未變動，行為不受影響

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [x] `npm test` 37/37、Playwright 面板驗證通過
- [ ] `openspec archive`
