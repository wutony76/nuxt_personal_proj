# Proposal

## Why

現有 `/game-hall` 是 Cyberpunk 復古街機，用分數換帳號 F 幣。柑仔店櫥仔是另一個產品：玩法不同、彩池不跟彩票混，但扣款與領取要寫進同一顆帳號 F 幣。

8 款玩法都先寫進規格。實作仍一次一款，從抽抽樂開始。本步驟不寫遊戲程式。

## What Changes

- 入口不另開大廳，也不加頂欄。在 `/lottery-hall-taiwan` 玩法貨架下方、頁尾上方，加一區「柑仔店櫥仔」。版面比照 `SAMPLE/Can you see this_/柑仔店彩票大廳.dc.html` 的櫥仔區塊。
- 遊戲頁都放 `app/pages/toys/`。路由是 `/toys/lucky-draw`、`/toys/cards`、`/toys/soda-whistle`、`/toys/bamboo-copter`、`/toys/gummy`、`/toys/big-pig`、`/toys/whistle-candy`、`/toys/pog`。不走 `/game/*`，不加進 `RETRO_GAMES`。
- 機率、抽獎、獎勵計算放 `server/services/game/toys/`。頁面只顯示服務回傳的結果。不繼承 retro / 彩票基底。
- 沒有新幣別。畫面上的金額就是帳號 F 幣，不存在童玩幣。下注與領取走 `walletBalanceService`。toys 只有一份彩池，8 款遊戲共用，不各做一池，也不進彩票彩池。
- 規格涵蓋 8 款。實作順序仍是抽抽樂、紙牌、汽水笛、竹蜻蜓、橡皮糖、大豬公、哨子糖、尪仔標。還沒做的卡可以露在櫥仔上，但不能進。
- 禁止 Canvas、大型遊戲引擎、新的大型 dependency。
- 視覺沿用彩運來既有 token，不另做一套主題，也不套 Cyberpunk。

本 change 沒有 **BREAKING** 變更。既有彩票、複古遊戲、帳號 F 幣行為不變。

## 規範衝突（實作前需你確認）

1. **語言**：`.cursorrules` 寫「禁止使用 TS」；`openspec/project.md` 規定 Vue / composable / util 用 TypeScript。本專案頁面、engine、service 已是 TypeScript。你的條件是「專案沒有 TypeScript 才不要導入」。**建議沿用 TypeScript**，不為童玩館改回 `.js`。
2. **Pinia**：`project.md` 寫全域狀態優先 Pinia，但 `nuxt.config.ts` 未註冊 Pinia，程式碼也沒有 `defineStore`。既有全域狀態是 composable 單例 `reactive`（`useGameHistory`、`useGameAccess`）。**建議帳號餘額仍由 API 回傳、頁面用 composable 接**，不為這個功能啟用未使用的 Pinia。
3. **Figma**：規則要求 Figma 未完成不得開發。本區以 `柑仔店彩票大廳.dc.html` 的櫥仔區塊為版面對照，沿用 `.theme-taiwan-lottery` 既有 token，不另開設計稿。

若你不同意以上三點，先改提案再實作。

## Capabilities

### New Capabilities

- `toy-arcade-shell`：彩運來頁上的柑仔店櫥仔、遊戲頁 Header、帳號 F 幣、toys 共用彩池、共用下注／結果／狀態。不併進彩票彩池。
- `toy-lucky-draw`：抽抽樂。盲抽，可領取或繼續抽，失敗歸零。
- `toy-cards`：紙牌。猜大、小或相同，連勝後可領取或繼續。
- `toy-soda-whistle`：汽水笛。繼續吹會加獎金也加爆掉機率，可隨時收下。
- `toy-bamboo-copter`：竹蜻蜓。先定高度，再播同一高度的飛行動畫。
- `toy-gummy`：橡皮糖。猜下一顆顏色，連勝可領取或繼續，猜錯歸零。
- `toy-big-pig`：大豬公。玩家與 NPC 各擲兩顆骰，比點數與特殊組合。
- `toy-whistle-candy`：哨子糖。短中長循環克制，並顯示 NPC 最近選擇。
- `toy-pog`：尪仔標。五張牌對戰與第一版特殊牌。

### Modified Capabilities

- 無。`openspec/specs/` 現有的 `fc3d-official`、`6hcCredit`、`6hcOfficial` 行為不變。

## Impact

- 修改 `app/pages/lottery-hall-taiwan.vue`：只在玩法貨架與頁尾之間插入櫥仔。不改既有彩票卡、不改 `AppTopbar.vue`。
- 新增 `app/pages/toys/`、`server/services/game/toys/`，以及薄 API `server/api/games/toys/`。API 只轉呼叫 service，不把公式寫在 route。
- 不加進 `shared/config/gameSlugs.js`，不進 `Storage.games` / `Storage.retroGames`，不進彩票彩池。
- `walletBalance.ts` 只新增 toys 的異動類型，餘額公式沿用既有 `appendChange`。
- 不新增 npm dependency。service 是純函式，測試腳本直接 import，不依賴登入。
- 圖鑑不在本 change。8 款的扣款與領取都寫入帳號 F 幣。
