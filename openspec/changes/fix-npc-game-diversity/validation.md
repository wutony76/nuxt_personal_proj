# Validation

## 功能驗證

重啟 Nitro 後查 `GET /api/admin/npc/settings`，20 個 NPC 的 `allowedGames`
數量與四個分類權重（節錄前 10 筆）：

| NPC | 遊戲數 | bgWeight | retroWeight | twWeight | toysWeight |
|---|---|---|---|---|---|
| AgathaCheyenne | 10 | 15 | 10 | 80 | 5 |
| AmariBentley | 23 | 10 | 80 | 10 | 15 |
| ArielOmar | 21 | 50 | 40 | 50 | 30 |
| AutumnXavier | 18 | 50 | 40 | 50 | 30 |
| BarbaraDevin | 12 | 10 | 20 | 10 | 70 |
| BraelynJustice | 22 | 10 | 80 | 10 | 15 |
| BrayanBobbie | 13 | 10 | 20 | 10 | 70 |
| BriaBlaise | 23 | 50 | 40 | 50 | 30 |
| BrodieBoone | 19 | 50 | 40 | 50 | 30 |
| BuckBraelyn | 13 | 10 | 20 | 10 | 70 |

修正前：20 個 NPC 的 `allowedGames.length` 全部相同（約 61，等於全部已
支援遊戲），四個分類權重也全部相同（共用全域 `_schedule` 預設值）。

修正後：遊戲數量分布在 10~23 款之間，四個分類權重對應五種不同原型（BG
彩迷／復古遊戲宅／台彩鐵粉／柑仔店熟客／雜食玩家），同原型的不同 NPC
遊戲數量也不完全相同（例如 AmariBentley 23 款、BraelynJustice 22 款，
同屬「復古遊戲宅」但實際勾選數量不同）——確認隨機性有確實生效，不是
每個原型對應一組寫死的固定清單。

Playwright 開 `/admin/npc`：面板正常渲染每個 NPC 的「X 款」標籤（10 款、
23 款、21 款、18 款、12 款...），互不相同；console 無錯誤。

## 回歸驗證

`npm test`（37 支既有測試腳本）：全數通過，本次改動僅涉及
`server/services/admin/modules/npcAutoPlay.ts` 的 NPC 建立邏輯，不影響
任何遊戲判定/結算/下注的核心邏輯。

## 成功標準檢查

- [x] NPC 自動新增後，各自的 `allowedGames`／分類權重皆有差異，不再全選
      全部 61 款遊戲
- [x] 既有管理員手動調整 API／UI 行為不受影響
- [x] 無新增重大 console / runtime error
- [x] 相關測試驗證完成
