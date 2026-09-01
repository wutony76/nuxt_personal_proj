## Why

遊戲中心目前 13 款遊戲沒有一款是傳統「打磚塊」類型。新增 BREAKOUT 補齊這個空缺：底部 Paddle 控制球拍、球自動飛行反彈、碰到磚塊即摧毀、清光磚塊過關。球物理與 PONG 的球拍碰撞高度相似（比照該先例、座標軸互換即可），磚塊碰撞是本次唯一需要新設計的邏輯，但複雜度可控。

## What Changes

- 新增遊戲頁面 `app/pages/game/breakout.vue`（**BREAKOUT**）：
  - **Paddle 控制**：←/→ 或 A/D 左右移動（比照既有鍵盤輸入慣例）。
  - **發球機制**：READY 倒數結束後球先靜止黏在 Paddle 正上方，玩家按空白鍵才真正發球開始物理模擬；掉球重置後也要再按一次空白鍵才重新發球（比照使用者規格明講的 `Ball Launch` 流程步驟，是本次唯一偏離其他遊戲「倒數完自動開打」既有慣例的地方）。
  - **球物理**：向量表示法（`ballVX`/`ballVY`），牆壁（左/右/頂）反彈為對應軸取負；Paddle 反彈依撞擊相對位置決定角度，直接比照 `PongEngine`（`app/pages/game/pong.vue`）已驗證過的手法（座標軸互換：PONG 左右來回、BREAKOUT 上下來回）；球速隨關卡與連續擊磚小幅提升，有上限。
  - **磚塊碰撞**：AABB 重疊比對＋最小重疊軸判斷撞擊面（X 軸重疊較小→撞左右側、Y 軸重疊較小→撞上下側），同一 tick 只處理第一個偵測到的重疊磚塊；磚塊為單次擊破。
  - **關卡系統**：固定關卡陣列（比照 MINESWEEPER 的 `LEVELS` 先例），每關一組磚塊佈局，難度隨關卡遞增（列數、佈局複雜度、球速上限）；清光全部存活磚塊觸發 `LEVEL CLEAR`（`playing` 狀態下的短暫過場提示，非獨立大狀態），球與 Paddle 歸位、載入下一關佈局，分數與生命值不重置。
  - **生命值**：3 條命，球掉出畫面底部（`BALL LOST`，同樣是短暫過場提示）扣 1 命，短暫停格提示後等待玩家重新發球；命數歸零觸發 `GAME OVER`。
  - **計分**：依磚塊所在列給分（越上排、離 Paddle 越遠分越高），比照 SPACE INVADERS 已驗證過的列分數模型，開放式無上限。
  - **Game State**：`ready → playing ⇄ pause → gameover`（沿用既有 4 態 union type 風格，不新增 `BALL_LOST`/`LEVEL_CLEAR` 作為獨立狀態，改用 `playing` 狀態下的子狀態與短暫訊息提示表達，見 design.md Decision 6）。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色（`#1de9b6` 薄荷青，跟現有十三款遊戲皆不撞色）。
  - 不使用任何外部圖片素材，不複製任何特定遊戲的 Logo、素材或受版權保護 UI（使用者明確要求）。
- 新增 server 端服務檔 `server/services/game/retro/breakout.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 的 `retroGamesInit()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/breakout/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'breakout'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon 🧱），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 14`、`name: 'BREAKOUT'`、`status: 'open'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `breakout` 這個新的 `gameKey`；`score` 語意延續「單局原始表現值」慣例（依磚塊列數加權得分累加），與 snake／racing／tetriminos／match3／runner／spaceShooter／spaceInvaders／typing 一致。生命值（3 條命）與關卡進度是純前端遊戲內狀態，不寫入 `useGameHistory` 紀錄，只有最終分數會被記錄。

## Impact

- 新增檔案（client）：`app/pages/game/breakout.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/breakout.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`retroGamesInit()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不影響既有十三款遊戲的程式碼與行為
