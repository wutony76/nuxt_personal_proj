## Why

遊戲中心目前 14 款遊戲的兩款 MATCH3（RUSH／CLASSIC）都是「兩次點擊選格→交換相鄰兩格」的傳統消除玩法。新增 ORB MATCH 補上另一種消除手感：參考轉珠遊戲的核心玩法——玩家按住一顆珠子後可以連續拖曳跨越多格，沿路交換位置，放開手指才統一結算消除與連鎖。這是本專案第一個拖曳型輸入，也是消除掃描/重力邏輯之外唯一需要全新設計的部分。

## What Changes

- 新增遊戲頁面 `app/pages/game/orb-match.vue`（**ORB MATCH**）：
  - **棋盤**：8 欄 × 8 列、6 種屬性珠。
  - **拖曳交換**：玩家按住（`pointerdown`）任一珠子後可連續拖曳跨格（`pointermove`），沿拖曳路徑逐格套用相鄰交換，過程中不檢查是否構成消除；拖曳中的珠子用 `position:absolute` 疊層跟隨指標座標，其餘格子維持 CSS Grid 排版（本專案第一個拖曳型輸入，沒有既有先例，見 design.md Decision 6）。
  - **單次拖曳時限**：最長 5 秒，時間到自動視為放開手指；拖曳中即時顯示倒數。
  - **結算時機**：放開手指（`pointerup`）或單次拖曳倒數歸零時，才統一掃描消除、連鎖、重力補齊一次，而非每次交換就掃描（比照 ToS 系列轉珠手感：拖曳中即使暫時排出連線也不會馬上消除）。
  - **消除／重力／連鎖演算法**：整段移植自 `app/utils/match3RushEngine.ts` 的無特殊珠版本（run-length 掃描、每欄由下往上補位、連鎖倍率 `matches.length*4*(1+(round-1)*0.5)`），只把正方形 `size` 拆成獨立的 `rows`/`cols`（見 design.md Decision 2）；不做 Bomb/Line Bomb/Color Bomb 等特殊珠機制。
  - **L/T 形連線加分**：比照 `match3Engine.ts` 的轉角合併判定（恰好 3 格的橫向 run 與恰好 3 格的縱向 run 共用一格），該組再乘上 1.5 倍額外加成，並在 combo 提示加上「L/T CONNECT!」文字；不生成特殊珠，只是分數加成（見 design.md Decision 2b）。
  - **場次結構**：整場限時 90 秒倒數，時間內可拖曳任意多次，時間到強制結算；不做固定步數模式，也不做怪物/組隊/回合制戰鬥（RPG meta-game，超出核心消除玩法範圍）。
  - **Game State**：沿用既有 4 態 `'ready'|'playing'|'pause'|'gameover'`，拖曳中/拖曳倒數是 `playing` 狀態下的子欄位，不新增大狀態。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色（`#9d4edd` 紫色，跟現有十四款遊戲皆不撞色）。
  - 不使用任何外部圖片素材，不複製任何特定遊戲的 Logo、素材、受版權保護 UI 或戰鬥/收集玩法（使用者明確要求）。
- 新增核心邏輯檔 `app/utils/orbMatchEngine.ts`（`OrbMatchCoreEngine`）：棋盤資料模型、消除掃描、重力補齊、無解重洗（移植自 `match3RushEngine.ts`），與拖曳交換原語 `moveHeldOrb()`。
- 新增 server 端服務檔 `server/services/game/retro/orbMatch.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 的 `gamesInitRetro()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/orb-match/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'orbMatch'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon 🔮，重用既有 `sparkle` 動畫類型），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 15`、`name: 'ORB MATCH'`、`status: 'open'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `orbMatch` 這個新的 `gameKey`；`score` 語意延續「單局原始表現值」慣例（依消除格數與連鎖倍率累加），與 snake／racing／tetriminos／match3／runner／spaceShooter／spaceInvaders／typing／breakout 一致。整場倒數與拖曳狀態是純前端遊戲內狀態，不寫入 `useGameHistory` 紀錄，只有最終分數會被記錄。

## Impact

- 新增檔案（client）：`app/pages/game/orb-match.vue`、`app/utils/orbMatchEngine.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/components/GameHallSprites.vue`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/orbMatch.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`gamesInitRetro()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不影響既有十四款遊戲的程式碼與行為
