## Context

- `add-game-history` 已建立 game-hall 小遊戲的完整架構：client 頁面自包含（engine class + reactive 鏡像 snapshot）＋ `useGameHistory`（A/B 雙模式）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）。
- 現有 13 款遊戲的邏輯組織方式：11 款是「inline class 寫在單一 .vue 檔案內」，只有 MATCH3 系列與 SOLITAIRE 因規則複雜度高（或需要共用）才把核心抽成獨立檔案。BREAKOUT 只有一個變體，且最直接的物理先例（PONG 的球拍碰撞）本身也是 inline 寫法，比照多數遊戲慣例整個寫在 `app/pages/game/breakout.vue` 內，不額外拆檔。
- `PongEngine`（`app/pages/game/pong.vue`）已有完整且驗證過的球物理：`ballVX`/`ballVY` 向量、牆壁反彈（對應軸取負）、`bounceOffPaddle()` 依撞擊相對位置決定反彈角。BREAKOUT 的球-牆壁、球-Paddle 碰撞直接比照這套手法，只是座標軸互換（PONG 左右來回、BREAKOUT 上下來回）。球-磚塊碰撞是全新邏輯，全專案沒有任何現有遊戲需要「球 vs 多個矩形物件、依撞擊面決定反彈軸」（見 Decision 2）。
- 現有遊戲的計分方向多數是「開放式無上限」，SPACE INVADERS 已驗證過「依所在列給分（越上排分越高）」的模型，跟磚塊遊戲的經典設計精神一致（後排離 Paddle 近分低、前排離 Paddle 遠更難打到分高），直接沿用（見 Decision 4）。
- MINESWEEPER 已有「固定關卡陣列＋`currentLevelIndex`＋過關才進下一關」的完整先例，磚塊佈局的「陣列驅動」精神完全通用，BREAKOUT 的關卡系統直接比照（見 Decision 3）。

## Goals / Non-Goals

**Goals:**
- 提供傳統打磚塊完整規則：Paddle 控制、球物理反彈（牆壁/Paddle/磚塊）、關卡制磚塊佈局、依列計分、生命值機制。
- 球物理沿用 PONG 已驗證的向量＋撞擊角手法，磚塊碰撞用簡單可靠的 AABB＋最小重疊軸判定，不引入複雜的連續碰撞偵測（swept AABB）或物理引擎依賴。
- Server 端、client 資料層、game-hall 入口完全比照既有十三款遊戲的慣例逐一擴充，不引入資料庫。
- 不使用任何外部圖片素材，不複製任何特定遊戲的 Logo、素材或受版權保護 UI（使用者明確要求）。

**Non-Goals:**
- 不做多次擊打才摧毀的耐久磚塊（規格明講「碰到 Brick 會摧毀 Brick」，磚塊皆為單次擊破）。
- 不做道具掉落／武器強化（雷射、分裂球等經典磚塊遊戲的進階要素），保持核心物理與關卡先做好。
- 不做關卡選擇／自訂關卡編輯器；關卡佈局是專案內建的固定陣列。
- 不做每日挑戰／成就／排行榜／統計。
- 不引入資料庫、不做遊戲重播，只存結算後摘要（分數、關卡）。
- 不影響既有十三款遊戲的程式碼與行為。

## Decisions

1. **Ball Physics：向量表示法＋撞擊位置決定反彈角，直接比照 `PongEngine` 手法（座標軸互換）**
   - 理由：PONG 已經有完整且經過玩家驗證的球拍反彈手感（依撞擊相對位置決定反彈角度，而非單純鏡面反射），直接沿用可以省去重新設計與調校物理手感的成本，且維持專案內「同類型物理只有一套手法」的一致性。
   - 做法：`ballVX`/`ballVY` 兩個分量；牆壁反彈（左/右/頂）：對應軸分量取負；Paddle 反彈：`relative = (ballCenterX - paddleCenterX) / (paddleWidth / 2)`，`ballVX = clamp(relative, -1, 1) * BALL_MAX_BOUNCE_VX`、`ballVY` 固定取負（往上彈）——這是 PONG 公式的座標軸互換版本（PONG 原本用相對位置決定 `ballVY`，因為 PONG 左右來回；BREAKOUT 上下來回，改成決定 `ballVX`）。球速：每次擊中磚塊小幅提升（`ballSpeedMul *= BALL_SPEED_STEP`，比照 PONG 的既有做法），有上限 `BALL_MAX_SPEED_MUL`；額外隨關卡提升球速上限，讓後期關卡整體更快。

2. **Brick Collision：AABB 重疊比對＋最小重疊軸判斷撞擊面，單次擊破**
   - 理由：這是全新邏輯，沒有現成先例，但磚塊遊戲的球速與磚塊尺寸都在可控範圍內，不需要複雜的連續碰撞偵測（swept AABB）；比照全專案既有的「固定 x/y 範圍矩形相交」判定手法（`overlaps()`，SPACE SHOOTER／SPACE INVADERS 皆是這樣做），只是套用在磚塊網格上。
   - 做法：`step()` 內每 tick 遍歷目前存活磚塊，用矩形相交判斷球是否與磚塊重疊；找到第一個重疊的磚塊後，比較「X 軸重疊量」與「Y 軸重疊量」，較小的一個代表撞擊面——X 軸重疊較小→撞到磚塊左/右側，`ballVX` 反向；Y 軸重疊較小→撞到磚塊上/下側，`ballVY` 反向；同一 tick 只處理這一個磚塊（找到後立即 break，避免同 tick 誤判多次反彈方向）。該磚塊標記摧毀、依所在列加分、觸發粒子效果。
   - 替代方案：連續碰撞偵測（沿球的移動路徑做線段與磚塊邊的相交測試）——放棄，磚塊遊戲的球速與 tick 頻率（16ms）下，離散重疊判定已經足夠準確，連續碰撞偵測的額外複雜度不符合這個專案「先讓機制跑起來、之後再校準」的既有原則。

3. **Brick／Level System：固定關卡陣列，比照 MINESWEEPER 的 `LEVELS` 常數陣列先例**
   - 理由：MINESWEEPER 已經驗證過「固定關卡陣列＋`currentLevelIndex`＋過關才進下一關」的架構，磚塊佈局用同樣的「陣列驅動」精神即可，不需要重新設計關卡系統。
   - 做法：`LEVELS` 為固定陣列，每關描述一組磚塊佈局（列數、每列磚塊數、球速上限）；`buildBricks(levelIndex)` 依佈局生成磚塊物件陣列（含所在列，供計分使用）。清光全部存活磚塊時：`level += 1`（超出 `LEVELS.length` 時循環或維持最後一關並持續加速，見 Open Questions）、球與 Paddle 歸位、`ballLaunched = false`（等待玩家重新按空白鍵發球）、觸發 `LEVEL CLEAR` 短暫過場提示；分數與生命值不隨換關重置（比照 SPACE INVADERS 波次制的既有精神）。

4. **計分：依磚塊所在列給分（越上排分越高），比照 SPACE INVADERS 已驗證過的手法**
   - 理由：磚塊遊戲的經典設計本來就是「後排（離 Paddle 近）分低、前排（離 Paddle 遠、更難打到）分高」，跟 SPACE INVADERS 的列分數模型精神一致，直接沿用「依列給分」這個既有先例，不重新設計計分模型。
   - 估算：例如 5 列由上到下 `[50, 40, 30, 20, 10]`；預期一場中高水準對局（打完 2～3 關）總分落在 800～2000 區間，比照多數遊戲預設抓 `coinRate: 0.3`、`coinCapPerRun: 300`、`coinDailyCap: 100000`，`maxReasonableScore(): 8000`（防偽造寬裕上限，比照 SPACE INVADERS／TYPING 的估算方式）。這些是估算值，上線後依實測校準。

5. **生命值：3 條命，球掉出畫面底部扣 1 命，命數歸零才 `GAME OVER`**（比照 SPACE SHOOTER／SPACE INVADERS／TYPING 先例）
   - 理由：多條命是這個 genre 的既有玩家預期，也已經是本專案動作類遊戲的既定慣例，直接沿用不重新設計。
   - 做法：`lives = 3`，球的 y 座標超出畫面底部時 `lives -= 1`、觸發 `BALL LOST` 短暫過場提示，球與 Paddle 重置到初始位置（已摧毀的磚塊不恢復），`ballLaunched = false` 等待玩家按空白鍵重新發球；`lives <= 0` 時觸發 `GAME OVER` 並結算。

6. **Game State：沿用既有 4 態 union type，`BALL_LOST`／`LEVEL_CLEAR` 實作成 `playing` 狀態下的短暫過場，不是獨立大狀態**（與使用者討論後確認）
   - 理由：使用者規格列出 `BALL_LOST`／`LEVEL_CLEAR` 兩個 Game State，但這兩個本質上是「PLAYING 中的短暫過場事件」，不需要暫停整個 tick 迴圈或改變頂層狀態機；比照 SPACE SHOOTER 的無敵時間、PONG 的 `SERVE_PAUSE_MS` 得分停格手法，用「`playing` 狀態下的子欄位（`ballLaunched`）＋短暫訊息提示（`transientMessage`，setTimeout 後自動清除）」表達，維持跟其餘十三款遊戲一致的 4 態 `'ready'|'playing'|'pause'|'gameover'` union type，不擴充狀態機規模。
   - **發球機制**（與使用者討論後確認，是本次唯一偏離既有慣例之處）：規格明確畫出 `Ball Launch` 流程步驟，因此 READY 倒數結束後球不會自動開始移動，而是先靜止黏在 Paddle 正上方（`launched = false`），玩家按空白鍵才真正發球（`launched = true`，開始套用球物理）；掉球重置或換關後也要重新按空白鍵才發球。這是本次唯一偏離其他遊戲「READY 倒數結束即自動開打」既有慣例的地方。
   - **實作中發現並修正的 bug**：掉球或過關重置球（`launched` 變回 `false`）之後，畫面下方的持續訊息文字原本沒有同步更新提示「按空白鍵發球！」，只有短暫的 `BALL LOST`/`LEVEL CLEAR` 過場文字消失後就沒有任何提示——玩家可能不清楚要再按一次空白鍵才能繼續。已修正為：tick 迴圈偵測到 `ballLost`／`levelCleared` 且球尚未發射時，立即把持續訊息文字改回發球提示，用 Playwright 實測確認修正前後畫面差異。

7. **Server／API／client 資料層完全比照既有慣例擴充，不做任何架構調整**
   - `RETRO_GAME_BASE` 不變、`server/api/games/retro/<game>/history.*` 資料夾樣式不變、`app/services/api.ts` 的 `api.games.retro.*` 命名方式不變、`useGameHistory.ts` 的 `GAME_KEYS`／`_handlers.gameApi()` switch 擴充一個分支即可。
   - `gameKey` 採用 `'breakout'`，路由路徑採 `breakout`（單一英文字，不需要 kebab-case 轉換）。

## Risks / Trade-offs

- [風險] 磚塊碰撞的「同一 tick 只處理第一個重疊磚塊」簡化，極端情況下（球速很快、磚塊排列緊密）可能跳過視覺上應該同時命中的相鄰磚塊——因應：球速有上限（`BALL_MAX_SPEED_MUL`），磚塊尺寸與 tick 頻率（16ms）搭配下，這種情況機率低；先讓機制跑起來，上線後如果實測體感不對再調整。
- [風險] 發球機制（按空白鍵發球）是本次唯一偏離既有「倒數完自動開打」慣例的地方，玩家可能不熟悉這個操作——因應：HUD／訊息文字明確提示「按空白鍵發球」，且這是使用者明確要求的既有 genre 標準行為（Breakout/Arkanoid 系列的通用操作）。
- [風險] 關卡佈局／球速曲線／磚塊分數皆為拍腦袋估算，可能太難或太簡單——因應：比照既有遊戲做法，先讓機制跑起來，上線後依實測校準，不影響架構本身。
- [風險] coin 倍率是估算值，可能跟其他遊戲的 coin/分鐘產出有落差——因應：`coinRate`／`maxReasonableScore` 是獨立於 `breakout.ts` 的常數，上線後可單獨調整。

## Migration Plan

- 全新功能，無既有資料需要遷移，刻意設計成獨立的 `gameKey`，不影響既有十三款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts`／`useGameHistory.ts` 擴充
  4. 遊戲頁面 `app/pages/game/breakout.vue`（此步驟起才有實際資料寫入行為）
  5. `game-hall.vue` + `gameSprites.ts` + `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- 打完 `LEVELS` 陣列最後一關之後怎麼處理（循環回第一關但球速不重置、或維持最後一關佈局持續加速、或直接算通關）——暫定維持最後一關佈局、球速持續依既有規則微幅提升，不特別做「通關」畫面，上線後可依實測回饋調整。
- 磚塊碰撞的「同一 tick 只處理一個磚塊」簡化，上線後應實測是否有明顯的漏判手感問題。
- 關卡佈局、球速曲線、磚塊分數皆為估算值，上線後應依實測校準。
