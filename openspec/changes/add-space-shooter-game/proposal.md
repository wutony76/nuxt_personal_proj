## Why

遊戲中心（game-hall）目前七款遊戲涵蓋操控（貪吃蛇）、賽道躲避（賽車）、堆疊消除（俄羅斯方塊／Match3 兩款）、對戰 CPU（PONG）、跑酷閃避（RUNNER），尚未有「射擊」類型：玩家操控飛船左右移動、發射子彈擊落持續來襲的敵機，是街機經典中最具代表性的類型之一。新增 SPACE SHOOTER 補齊這個空缺。

## What Changes

- 新增遊戲頁面 `app/pages/game/space-shooter.vue`（**SPACE SHOOTER**）：
  - 俯視角縱向捲軸射擊：玩家飛船固定在畫面下方，只能左右移動（←/→ 或 A/D），按住空白鍵／Enter 以固定射速連續發射子彈（比照經典 Galaga／Space Invaders 玩法）。
  - 敵機由畫面上方持續生成、向下移動並帶有輕微左右漂移（正弦波路徑），分兩種：基本敵機（低血量／低分）、強化敵機（高血量／高分）；部分敵機會不定期向下發射子彈，玩家需同時兼顧射擊與閃避。
  - **首度引入「生命值」機制**（3 條命）：玩家被敵機或敵彈擊中扣 1 命，扣命後有短暫無敵時間並重生於畫面下方中央，命數歸零才真正結束（不同於現有其他遊戲「撞一下就結束」的既有慣例）。
  - 分數＝擊落敵機的加權得分（基本／強化敵機分數不同）× 連擊倍率，開放式無上限；等級隨分數提升，帶動敵機生成頻率、移動速度、敵彈發射頻率同步提高（比照既有「Lv 隨進度提升」慣例）。
  - **連擊／分數倍率**：連續擊落敵機不中斷（未被扣命）會累積連擊數，倍率隨連擊數分級提升（x1→x2→x3→x4）；被擊中扣命時連擊歸零。
  - **道具掉落**：擊落敵機有機率掉落道具（護盾／加速射擊／散射彈），飛船飛過即拾取；護盾可抵銷一次傷害、加速射擊與散射彈為限時武器強化，強化敵機掉落機率較高。
  - **里程碑強敵**：分數每跨過一個門檻，額外生成一隻高血量、高分、移動方式不同（左右橫掃）的獨特強敵，擊落必掉道具；不是完整 boss 系統（無過關／波次狀態機，維持連續生成的既有模式）。
  - **視覺特效加強**：星空視差背景（多層星點以不同速度下移）、擊落／被擊中時的爆炸粒子效果、玩家被擊中時的畫面震動，純呈現層，不影響任何遊戲邏輯與資料層。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色（`#4d7fff` 電光藍，跟現有七款遊戲皆不撞色）。
- 新增 server 端服務檔 `server/services/game/retro/spaceShooter.ts`，繼承既有 `RETRO_GAME_BASE`（`coinRate`／`maxReasonableScore` 依新的計分模型獨立估算，見 design.md），並在 `server/services/storage.ts` 的 `retroGamesInit()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/space-shooter/history.{get,post,delete}.ts`，比照既有七款遊戲樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'spaceShooter'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆。
- `app/pages/game-hall.vue` 把一個 `status: 'coming'` 佔位格（id 8）改為 `SPACE SHOOTER`（`status: 'open'`），`app/components/GameMachineCard.vue` 新增對應圖示（🚀）。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `spaceShooter` 這個新的 `gameKey`；`score` 語意延續「單局原始表現值」慣例（擊落敵機得分），與 snake／racing／tetriminos／match3／runner 一致，不像 PONG 是「勝場數」的特例定義。生命值（3 條命）是純前端遊戲內狀態，不寫入 `useGameHistory` 紀錄，只有最終分數會被記錄。

## Impact

- 新增檔案（client）：`app/pages/game/space-shooter.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/pages/game-hall.vue`、`app/components/GameMachineCard.vue`
- 新增檔案（server）：`server/services/game/retro/spaceShooter.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`retroGamesInit()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不影響既有七款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner）的程式碼與行為
