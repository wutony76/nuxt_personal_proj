## Context

本次為第一階段規劃：先盤點原始需求要求檢查的八個項目在現有架構中的對應現況與可重用模組，確認 FLAPPY 該延伸哪些既有先例、該新開哪些設計，尚未進入實作。

- **Game Center**：`app/pages/game-hall.vue` 以 `gameSlots` 陣列（`{ id, name, description, status, path }`）驅動卡片列表，`GameMachineCard.vue` 讀 `app/config/gameSprites.ts` 的 `GAME_SPRITES`（`icon`／`anim`／`glow`）套版型與主題色。目前 `gameSlots` 最後一筆為 `id: 16`（battleship）；FLAPPY 依規劃登記為 `id: 18`。新增遊戲的登記點固定為五處：`gameSprites.ts`、`game-hall.vue`、`app/services/api.ts` 的 `RetroGameKey`、`useGameHistory.ts` 的 `GAME_KEYS`、`GameHistoryDialog.vue` 的篩選 tab，FLAPPY 直接沿用，不需調整架構。
- **Game Loop**：全專案沒有集中式 Game Loop composable，每款遊戲各自在 `<script setup>` 內用 `setInterval` 驅動 tick（例如 `runner.vue` 的 `TICK_MS = 16`），`onMounted`/`onUnmounted` 管理計時器生命週期。FLAPPY 直接沿用此模式，tick 內固定執行「玩家物理積分 → 管道捲動/回收 → 生成 → 碰撞判定 → 計分」的順序，不引入 `requestAnimationFrame`。
- **Input**：同樣沒有集中式 Input composable，各頁面自行在 `onMounted` 綁 `window.addEventListener('keydown'/'keyup', ...)`、`onUnmounted` 解綁（見 `runner.vue` 的 `onRunnerKeydown`/`onRunnerKeyup`）。FLAPPY 的操作比 runner 更單純（只有一個「flap」動作，沒有下蹲需要 keyup 追蹤放開狀態），額外需要在遊戲畫面容器綁 `click`（滑鼠）與 `touchstart`（觸控），三種輸入來源（Space/↑鍵、滑鼠點擊、觸控 tap）最終都呼叫同一支 `engine.flap()`，不重複寫三套判定邏輯。
- **Collision**：現有各遊戲的碰撞判定各自為政、沒有共用模組——`runner.vue` 用 `overlapsX`/`overlapsY` 兩段矩形重疊；`minesweeper` 是格子索引比對；`battleshipEngine.ts` 的 `attackCell()` 是座標對應船體格。FLAPPY 延續 runner 的「矩形重疊」風格，但管道是「上下兩段」而非單一障礙物，需要 `checkCollision()` 對管道的上／下兩段矩形框各判一次，集中在 `flappyEngine.ts` 內一支純函式管理（呼應原始需求「Collision 集中管理」）。
- **Scroll**：`runner.vue` 已示範「等級制」的捲動加速（`scrollSpeed = BASE_SCROLL_SPEED + (level - 1) * SCROLL_SPEED_PER_LEVEL`，隨離散等級跳增）；`racing.vue` 則是隨時間持續加速。FLAPPY 沒有離散關卡概念，改採「隨分數連續內插、夾住 `maxSpeed` 上限」的公式（見 Decision 2），比照兩者精神但公式形式不同。
- **Score**：現有遊戲的計分方式分兩類——「表現越好分數越高、理論無上限」（runner／racing）與「有精確理論上限」（minesweeper／battleship）。FLAPPY 的「通過管道數」屬於前者：每通過一組管道 +1，沒有數學上限，只能像 runner／racing 一樣抓寬裕的防偽造上限（見 Decision 4）。
- **Game State**：專案慣例是頁面內一個 `reactive()` 統一狀態物件，搭配一組有限狀態值（例如 runner 的 `RunnerStatus = 'ready'|'playing'|'pause'|'gameover'`）驅動 UI 顯示與互動開關，`click`/`_actions`/`_handlers` 三分法（`openspec/project.md` 規範）。FLAPPY 直接沿用同樣的四態設計，不需要新增狀態機複雜度（不像 battleship 需要九態的回合制狀態機）。
- **High Score**：沒有任何遊戲另外設計「最高分」儲存機制，一律讀 `useGameHistory().statsByGame[gameKey].best`（由歷史紀錄的 `score` 陣列取 max 計算得出，見 `useGameHistory.ts` 的 `statsByGame` computed）。FLAPPY 沿用此既定模式，UI 上顯示「HIGH SCORE」時直接綁定這個值，不另存 localStorage key。
- **既有最接近先例的差異點**：`runner.vue` 的「重力＋跳躍＋自動捲軸」是 FLAPPY 最接近的既有先例，但兩者的角色物理型態不同——runner 角色固定於地面（`playerState: 'standing'|'jumping'|'ducking'`，跳躍是「有始有終」的拋物線動畫，落地後回到 standing），FLAPPY 角色沒有地面可站立，是「持續受重力下墜、點擊給一次性向上衝力」的連續物理，沒有「standing」這個穩態；障礙物結構也不同——runner 的 `Obstacle` 是單一矩形（地面型或空中型擇一），FLAPPY 的 `Pipe` 是「上下兩段＋中間 gap」的成對結構，需要新的型別與碰撞判定範圍，本次為架構新增而非直接複用。

## Goals / Non-Goals

**Goals：**
- 提供經典 Flappy 類反應玩法：連續重力下墜、點擊/Space/Touch 給一次性向上衝力、自動向右捲動、穿越成對管道空隙、通過即 +1 分、撞管道或地面即 Game Over。
- 遊戲參數（`gravity`／`jumpVelocity`／`scrollSpeed`／`pipeGap`／`pipeSpawnInterval`／`maxSpeed`）集中在 `flappyEngine.ts` 頂部管理，不散落在頁面各處。
- Game Logic（Player 物理／Pipe 生成回收／Collision／Score／Game State）完全不依賴 DOM，抽到 `app/utils/flappyEngine.ts`；Rendering（頁面 template/CSS）與 Logic 分離，頁面只負責把 `getSnapshot()` 的資料映射成畫面。
- 使用原創 Pixel 角色與障礙物造型／配色，明確迴避 Flappy Bird 的角色、素材、Logo 或其他受版權保護內容。
- Server 端、client 資料層、game-hall 入口比照既有十六款遊戲的慣例逐一擴充。

**Non-Goals：**
- 不使用 Canvas 繪製（原始需求提及「使用 Canvas / Pixel Shape」，但與專案現況的 DOM/CSS 渲染慣例不符，本次規劃沿用專案慣例，列為 Open Question 供使用者確認，見下）。
- 不做多角色／多外觀切換、道具、Power-up、無敵時間等額外玩法擴充。
- 不做每日挑戰／關卡制／不同難度模式；難度曲線僅由 `scrollSpeed` 隨分數緩步提升到 `maxSpeed` 構成，不做離散關卡。
- 不做特效動畫（羽毛飄散、碎裂粒子、Screen Shake）、音效——本次只做狀態正確切換與基本視覺提示，Polish 留待後續變更。
- 不做 Online 排行榜／多人對戰；`High Score` 僅取自 `useGameHistory` 既有的個人歷史最高分。
- 不引入資料庫；server 端持久化沿用專案現況的 in-memory 作法。

## Decisions

1. **Pipe 資料結構採「上下成對＋中間 gap」，比照 runner 的 tick 移動／回收模式但擴充為成對結構**
   - 理由：需求明確要求「穿過管道／障礙物的空隙」，這是單一矩形障礙物無法表達的結構；runner 的 `obstacles` 陣列（`x`/`width`/`height`，tick 中左移、超出畫面即濾除、`spawnObstacle()` 定時生成）是最接近的既有先例，可直接沿用「陣列＋tick 移動＋動態生成/銷毀」的骨架，只需把單一矩形換成「上管＋下管」的成對描述。
   - 做法：`Pipe = { id, x, gapTop, gapHeight, width, passed }`，其中上管道涵蓋 `[0, gapTop)`、下管道涵蓋 `[gapTop + gapHeight, STAGE_HEIGHT)`；`gapHeight` 固定為常數 `pipeGap`，`gapTop` 於 `spawnPipe()` 時在合理範圍內隨機（避免貼頂或貼底導致空隙貼著邊界不合理）；`passed` 於角色通過後標記為 `true`，防止同一組管道重複計分。tick 中所有 `pipes` 的 `x -= scrollSpeed`，`x + width < -margin` 即濾除；`spawnPipe()` 依 `pipeSpawnInterval`（tick 數或水平距離，見 Decision 2）觸發。
   - 替代方案：沿用 runner 的單一矩形 `Obstacle`、用「上管」「下管」各自一筆記錄——放棄，會讓「一組管道」的通過計分與 gap 一致性判斷分散在兩筆資料上，容易產生「上管過了但下管漏判」的邊界 bug；成對結構讓 `passed` 與 gap 幾何自然綁在同一筆資料。

2. **重力／跳躍採「速度累加」連續物理，非 runner 式的固定拋物線動畫；`scrollSpeed` 隨分數連續內插並夾住 `maxSpeed`**
   - 理由：runner 的跳躍是「按一次跳、固定 `JUMP_DURATION_TICKS` 走完拋物線、落地回到 standing」的離散動作，落地後角色永遠回到固定高度；FLAPPY 需求是「沒有操作時角色受重力向下」的連續下墜，角色沒有地面可落地，必須用「速度＋位置」的標準物理積分，不能套用 runner 的拋物線動畫寫法。
   - 做法：每 tick 執行 `velocityY += gravity`（`gravity` 為正值，向下為正）、`playerY += velocityY`；`flap()` 觸發時 `velocityY = jumpVelocity`（`jumpVelocity` 為負值，直接覆寫而非疊加，避免連續快速點擊造成速度無限疊加往上飛出畫面）。`scrollSpeed` 不像 runner 依離散等級跳增，改為 `scrollSpeed = min(maxSpeed, baseScrollSpeed + score * scrollSpeedPerPoint)`，隨分數（而非離散關卡）連續緩步提升，並用 `maxSpeed` 夾住上限，避免分數衝高後速度失控到無法反應。
   - 替代方案：比照 runner 用固定時長的拋物線動畫描述跳躍——放棄，Flappy 類玩法的手感關鍵就是「連續、可疊加中斷的重力積分」（例如下墜到一半再點一次會立刻反向上衝），固定時長拋物線動畫做不出這個手感，且需求明確寫「沒有操作時角色受重力向下」隱含連續物理而非離散動作。

3. **渲染沿用專案既有 DOM/CSS 慣例，不使用 Canvas（使用者已確認採用此方案，與原始需求「使用 Canvas / Pixel Shape」的落差已拍板以專案既有慣例為準）**
   - 理由：原始需求開發原則寫「使用 Canvas / Pixel Shape」，但全專案十六款遊戲、零 `<canvas>` 元素，一律用 CSS Grid/DOM 元素＋`v-for`／絕對定位做「瞬間重繪」渲染（例如 runner 的 `.rn-obstacle`/`.rn-player` 皆為絕對定位的 `<div>`）。若 FLAPPY 唯獨改用 Canvas，會打破「Game Logic 與 Rendering 分離」在本專案的既有實踐方式（其他遊戲的分離是「engine class／utils 檔」vs「Vue template」，換成 Canvas 會變成「engine」vs「Canvas draw 函式」，渲染技術棧不一致，未來共用/重構成本增加），也不符合「不修改無關程式」以外的「風格一致性」精神。
   - 做法（本次規劃建議）：沿用 DOM/CSS 渲染，角色與管道皆為絕對定位的 `<div>`／CSS 方塊，管道用兩個獨立的矩形 `<div>`（上管／下管）疊加同一個 `x` 座標渲染，比照 runner 的 `obstacleStyle()` 用 inline style 綁 `left`/`top`/`width`/`height`。tick 頻率（`TICK_MS`，建議與 runner 一致 16ms）足以做出流暢的「瞬間重繪」視覺效果，不需要 Canvas 的繪圖 API。
   - 替代方案：改用 `<canvas>` + Canvas 2D API 直接畫像素方塊——已評估後不採用，因為與現有架構、共用元件（`GameRateDialog`/`GameRuleDialog` 等 Vue 元件疊加在遊戲畫面上）的整合成本最低，沿用 DOM/CSS 慣例定案。

4. **`maxReasonableScore()` 比照 runner／racing 的開放式計分寬裕上限抓法，`coinRate`／`coinCapPerRun` 依「一場優秀表現 ≈ 100 coin」目標校準**
   - 理由：FLAPPY 的分數（通過管道數）沒有數學上限，不像 battleship／minesweeper 有精確天花板，只能比照 runner（`maxReasonableScore(): 1700`）／racing 的既有做法抓一個「遠超正常人類表現、但足以擋掉明顯異常回報值」的寬裕上限；需求描述「典型優秀表現落在數十到一兩百之間」，取一場優秀表現 ≈ 150 分校準 coin 倍率。
   - 初始估算：`coinRate: 0.7`（150 分 ≈ 105 coin，對齊「一場優秀表現 ≈ 100 coin」的既有目標）；`coinCapPerRun: 160`（略高於 105，抓一點餘裕防呆，比照其他開放式計分遊戲的抓法）；`coinDailyCap: 100000`（沿用全遊戲統一慣例）；`maxReasonableScore(): 500`（遠高於典型優秀表現的一兩百分，足以涵蓋極端高手表現，同時擋掉明顯異常/偽造的回報值）。
   - 這些是程式碼估算值，比照既有慣例，上線後應依實測分數分佈校準（尤其如果高手實際表現能穩定衝到兩三百分以上，`maxReasonableScore` 與 `coinCapPerRun` 可能需要上修）。

5. **碰撞判定範圍：角色矩形 vs 管道上/下兩段矩形＋觸底；撞頂（ceiling）不算 Game Over，只夾住位置**
   - 理由：需求明確寫「撞到障礙或地面後 Game Over」，只列了「障礙」與「地面」兩種死亡條件，沒有提到撞頂算死亡；多數 Flappy 類玩法的既定手感也是「衝太高只是撞到畫面頂端彈回／卡住，不會因此死亡」，只有下墜到底才會死。
   - 做法：`checkCollision()` 純函式集中管理，依序檢查 (a) 角色矩形是否與任一 `pipe` 的上管矩形重疊、(b) 是否與下管矩形重疊、(c) `playerY + playerHeight >= STAGE_HEIGHT`（觸底）——任一成立即回傳 `gameOver: true`。角色矩形範圍即角色的 pixel sprite 佔用區塊（固定 `width`/`height`，不像 runner 的下蹲有高度變化）。若 `playerY <= 0`（撞頂），單獨處理為「夾住 `playerY = 0`、`velocityY = max(0, velocityY)`」，不觸發 Game Over，也不計入碰撞判定的回傳結果。
   - 替代方案：撞頂也算 Game Over（更貼近「地面」概念的鏡像版本）——放棄，這會讓玩家「重力還沒發動、開局立刻連續點擊衝頂」意外死亡，體驗不佳且非需求明確要求的行為，予以排除。

6. **原創美術與版權迴避：角色與管道刻意採用與 Flappy Bird 不同的造型與配色，並以純 CSS 方塊拼接**
   - 理由：原始需求明確要求「不要直接複製 Flappy Bird 的角色、素材、Logo 或受版權保護內容，使用原創 Pixel 角色與障礙物」；Flappy Bird 的可辨識視覺特徵集中在「黃色鳥型輪廓＋紅色鳥嘴」「綠色圓頭水管＋淺藍天空背景」這組配色與造型組合，需刻意避開。
   - 做法：角色造型改用「非鳥類、無鳥嘴輪廓」的原創像素方塊生物（例如簡單的方形／菱形像素怪獸或機械方塊，由 2-3 個矩形 `<div>` 拼接，不做寫實鳥型剪影）；管道造型改用「方正直角、非圓頭」的像素柱狀障礙（例如像素能量柱／方塊塔），配色採主題色 `#06d6a0`（青綠色）為主軸，背景採深色系（比照專案其他遊戲的深色 arcade 背景慣例），不使用「黃＋綠＋淺藍」這組 Flappy Bird 標誌性配色組合。全程使用 CSS 繪製方塊組合，不使用外部圖片、不引入圖像素材依賴。
   - 替代方案：沿用類似鳥形剪影＋綠色圓頭水管的通用「flappy 類遊戲」視覺慣例——放棄，雖然「管道躲避」是需求原文的通用玩法描述、非版權內容本身，但角色/障礙物的具體造型與配色若與 Flappy Bird 過於相似仍有觀感疑慮，本次規劃選擇更明確區隔的原創方向。

## Risks / Trade-offs

- [風險] 純點擊型的單鍵反應玩法，若 tick 頻率（`TICK_MS`）與 `gravity`/`jumpVelocity` 數值搭配不當，容易出現「手感過重（幾乎按不動）」或「手感過飄（一按就飛出畫面）」——因應：這些參數集中在 `flappyEngine.ts` 頂部管理（呼應原始需求「遊戲參數集中管理」），後續實作階段可透過實測反覆調校，不影響架構本身。
- [風險] `scrollSpeed` 隨分數持續提升到 `maxSpeed` 上限後，長時間存活的玩家會停在同一個難度，可能讓「衝高分」變成單純的耐力賽而非技巧驗證——因應：這是需求「目標是取得最高分」的既定玩法本質（多數 Flappy 類遊戲皆是如此），`maxSpeed` 上限本身就是刻意設計，避免無限提速導致的不可控難度，非本次需要解決的問題。
- [風險] Decision 3（沿用 DOM/CSS、不用 Canvas）若使用者最終仍堅持要 Canvas，會牽動 Rendering 層的技術選型重寫（Engine/Logic 層不受影響，因為兩者本來就分離）——因應：已在 Decision 3 與 Open Questions 明確列出，待使用者確認後若需改為 Canvas，只需替換頁面的 rendering 部分，`flappyEngine.ts` 的純邏輯核心不需要修改。
- [風險] 「撞頂不死、只夾住位置」的規則（Decision 5）若使用者原本預期「撞頂也算死」，需要在實作前確認，避免做完才發現判定範圍不符預期——因應：已在 Decision 5 明確記錄理由與替代方案，可在使用者確認整份規劃時一併確認此判定範圍是否為預期行為。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成獨立的 `gameKey`（`'flappy'`），不影響既有十六款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/flappyEngine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試）
  6. 遊戲頁面 `app/pages/game/flappy.vue`（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `GameMachineCard.vue`（透過 `gameSprites.ts`）+ `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- ~~Canvas vs DOM/CSS 渲染~~ **已拍板**：沿用專案既有 DOM/CSS 渲染慣例，不使用 Canvas。
- **撞頂（ceiling）判定**：本次規劃（Decision 5）預設「撞頂不算 Game Over，只夾住位置」，是否符合使用者預期，或希望撞頂也視為死亡條件（需求原文只提到「撞到障礙或地面」，未明確排除撞頂）？
- **難度曲線細節**：`scrollSpeed` 隨分數提升到 `maxSpeed` 的具體公式／數值（`baseScrollSpeed`／`scrollSpeedPerPoint`／`maxSpeed`）僅為本次規劃的估算方向，實際數值需在實作階段實測調校，是否需要在下一輪先討論一個大致的難度曲線目標（例如「多少分後達到最高難度」）？
- **coinRate／coinCapPerRun／maxReasonableScore 數值**：Decision 4 的估算值（`0.7`／`160`／`500`）僅為初步校準，上線後應依實測分數分佈調整，是否需要抓更保守或更寬鬆的初始值？
