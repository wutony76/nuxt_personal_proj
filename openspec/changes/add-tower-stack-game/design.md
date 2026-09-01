## Context

原始需求要求先檢查六個面向（Game Loop／Input／Collision／Animation／Score／Game State）在現有架構下如何落地，逐一盤點如下：

- **Game Loop**：全專案沒有集中式 Game Loop composable，也沒有任何一款遊戲使用 `<canvas>` 或 `requestAnimationFrame`；每款遊戲頁面各自在 `<script setup>` 用 `setInterval`／`setTimeout` 驅動 tick，`onMounted` 綁定事件、`onUnmounted` 解綁。TOWER STACK 沿用這個慣例，比照 `breakout.vue` 的 `TICK_MS = 16` 單一 tick timer，每 tick 呼叫 `engine.step()` 更新 moving block 位置、掉落碎片位置、難度檢查。
- **Input**：三種輸入（點擊／`Space`／觸控）語意完全相同——只做「drop」這一個動作，沒有方向鍵、沒有拖曳，是全專案「輸入最單純」的一款。比照既有遊戲在 `onMounted` 綁定 `keydown`，畫面上疊一層可點擊／可觸控的舞台容器。
- **Collision（重疊判定）**：現有遊戲的碰撞都是二維 AABB（BREAKOUT 的球磚碰撞）或棋盤格對格比對（MINESWEEPER／BATTLESHIP），沒有一款是「一維水平區間交集」。TOWER STACK 的核心規則就是這種一維 Overlap Detection，是本次唯一沒有既有先例可直接套用的部分（見 Decision 1）。
- **Animation**：沒有重疊的部分掉落，需要「短暫存在、之後消失」的過渡視覺——`breakout.vue` 的 `particles: [] as Particle[]` 陣列（帶初始位置、push 進陣列、`setTimeout` 計時後從陣列移除）是最接近的既有先例，可直接沿用同一種「陣列＋定時清除」模式，差異只在於本次的碎片需要每 tick 更新下落位置（多一組簡單的位置／速度狀態），詳見 Decision 3。
- **Score**：現有遊戲的計分模型多數是「表現越好分數越高」的開放式或有理論上限的區間值（BATTLESHIP 是唯一「勝利分數恆為固定值」的例外）。TOWER STACK 的塔高＋Combo 加成屬於開放式計分，沒有理論上限，比照多數既有遊戲的估算慣例處理 `maxReasonableScore()`（見 Decision 5）。
- **Game State**：`ready → playing → paused → gameover` 四態，與 BREAKOUT／MINESWEEPER 的既有狀態機完全一致，不需要新設計。

此外，現有十六款遊戲裡沒有任何一款的「移動方塊寬度會依玩家操作動態縮減」——這是 TOWER STACK 疊塔玩法的核心，需要在本文件明確記錄為本次唯一的新架構部分（Overlap Detection → Block Resize → Falling Piece 三步驟串接），其餘 Server／Client 資料層、game-hall 入口皆為既有樣板複製擴充。

原始需求提到「Canvas / Pixel Shape」，但全專案十六款遊戲皆為 DOM/CSS 渲染、零 `<canvas>`。這是需求原文與既有架構之間的落差，本文件在 Decision 6 記錄落差並提出方案，同時列為 Open Question 讓使用者確認。

## Goals / Non-Goals

**Goals:**
- 提供「Moving Block → Drop → Overlap Detection → Block Resize → Falling Piece」的完整堆塔迴圈，塔越疊越窄，完全沒有重疊時立即結束。
- 提供 Perfect／Combo 機制：偏移在 `perfectThreshold` 內判定為 Perfect，維持原寬並累積 Combo 額外加分；非 Perfect 的成功疊放會中斷 Combo。
- 難度隨疊放次數遞增（`blockSpeed` 依 `speedIncrease` 遞增，`maxSpeed` 封頂），所有遊戲參數集中管理（見 Decision 5）。
- Game Logic（Overlap Detection／Block Resize／Falling Piece／Perfect／Combo／難度）完全不依賴 DOM，抽到 `app/utils/towerStackEngine.ts`；Server 端、client 資料層、game-hall 入口比照既有十六款遊戲的慣例逐一擴充。
- 三種輸入方式（鍵盤／滑鼠／觸控）共用同一個 `dropBlock()` 動作，全程零拖曳。

**Non-Goals:**
- **不加入複雜 Physics Engine**：掉落碎片只做簡單的等加速度下落（固定重力常數），不做旋轉、不做碎片與碎片之間的碰撞、不做碎片與塔身的二次碰撞判定。
- 不做多種方塊形狀（僅矩形）、不做特殊道具／能力（放慢時間、加寬方塊等）。
- 不做多人／排行榜即時對戰，計分與 coin 轉換沿用既有 `useGameHistory` 單機紀錄模式。
- 不做音效、不做爆炸／震動等進階特效動畫（僅基本顏色／文字提示），Polish 留待後續變更。
- 不引入資料庫；server 端持久化沿用專案現況的 in-memory 作法。
- 不使用 `<canvas>`、不引入 `requestAnimationFrame`（見 Decision 6）。

## Decisions

1. **Overlap Detection 採一維水平區間交集運算，不做二維 AABB**
   - 理由：塔身與移動方塊的碰撞只發生在水平軸（Y 軸疊放位置由層數固定決定，不需要判斷），二維 AABB（如 BREAKOUT 的球磚碰撞）在此是不必要的複雜度。
   - 做法：塔頂現有層的水平範圍記為 `[layerLeft, layerRight]`，新方塊落下瞬間的水平範圍記為 `[blockLeft, blockRight]`；交集 `overlapLeft = max(layerLeft, blockLeft)`、`overlapRight = min(layerRight, blockRight)`、`overlapWidth = overlapRight - overlapLeft`。`overlapWidth <= 0` 判定為完全沒有重疊（Game Over）；`overlapWidth > 0` 則進入 Block Resize／Perfect 判定。純函式 `detectOverlap(layer, block)`，不依賴 Vue、不依賴 DOM。
   - 替代方案：比照 BREAKOUT 用完整的二維 AABB＋最小重疊軸判斷——放棄，Y 軸疊放位置本來就是固定的（新層永遠疊在塔頂正上方），二維判斷只會多算一個恆定不變的軸，沒有實質意義。

2. **Block Resize：新層寬度＝交集寬度，位置＝交集起點；新方塊沿用新層寬度，不是沿用原始寬度**
   - 理由：需求明確「重疊越少，塔越窄」，且下一顆移動方塊必須疊在新的（已縮減的）塔頂之上，因此新方塊的初始寬度必須等於「上一次疊放後的新層寬度」，塔身寬度才會持續累積遞減，而不是每次都從原始寬度重新開始縮減。
   - 做法：`resizeBlock(layer, block, overlap)` 回傳 `{ width: overlap.overlapWidth, x: overlap.overlapLeft }`；此結果同時作為（a）本次疊上塔頂的新層資料，與（b）下一顆 moving block 生成時的初始寬度。因為新方塊每次都是「上一層的寬度」，塔身寬度只會單調不增，符合「重疊越少，塔越窄」的需求語意。
   - 替代方案：新方塊固定使用初始寬度、只有塔身視覺變窄——放棄，這樣會讓「疊放偏移」的懲罰只影響視覺不影響下一次判定難度，與需求「重疊越少，塔越窄」的精神（越窄代表下一次容錯空間越小）不符。

3. **Falling Piece（掉落碎片）沿用 breakout `particles` 陣列模式，但額外加入每 tick 位置更新**
   - 理由：需求要求「沒有重疊的部分掉落」需要視覺呈現，`breakout.vue` 的 `particles: [] as Particle[]` 是全專案最接近的既有先例（帶初始位置、push 進陣列、計時後移除），可直接沿用陣列管理模式；差異在於本次碎片需要「下落」的視覺效果，因此比 breakout 的靜態粒子多帶一組 `vy`（下落速度）與每 tick 位置更新。
   - 做法：Block Resize 判定出的「未落入交集範圍的部分」（單一矩形，因為移動方塊寬度恆等於塔頂寬度，偏移只會讓其中一側產生單一段懸空區域，不會同時懸空兩側，見下方說明）生成一個 `FallingPiece = { id, x, y, width, height, vy }`，`vy` 給定初始值後，每 tick 由 `engine.step()` 以固定重力常數遞增（等加速度直線運動，非彈跳、非旋轉，符合 Non-Goal「不加入複雜 Physics Engine」）；當 `y` 超出舞台高度，或存在時間超過生命週期上限（比照 breakout 過渡效果的量級，抓數百毫秒級）時，從陣列移除。因為 moving block 的寬度恆等於塔頂寬度（見 Decision 2），偏移只會讓方塊往左或往右超出一側，交集之外只會有「一段」矩形，不會出現左右兩段同時掉落的情況，掉落碎片邏輯因此维持單一物件、不需要陣列裡同時塞兩顆碎片。
   - 替代方案：掉落碎片維持靜止不動、只做淡出動畫（比照 breakout 實際程式碼裡的靜態粒子做法）——放棄，「掉落」是需求明確描述的視覺語意（碎片應該真的往下墜落離開畫面），純淡出無法呈現這個動作。

4. **Perfect 判定採可設定的位移閾值 `perfectThreshold`，觸發時完整寬度保留＋Combo 遞增；任何非 Perfect 的成功疊放會讓 Combo 歸零**
   - 理由：需求明確「新方塊與上一層幾乎完全重疊」時才判定 Perfect，且「連續完美堆疊可以增加 Combo」暗示 Combo 是一個連續性指標，一旦出現不夠精準的疊放就應該中斷。
   - 做法：計算 `offset = overlapWidth < layerWidth ? (layerWidth - overlapWidth) : 0`（即新方塊與塔頂層之間沒有重疊到的寬度），當 `offset <= perfectThreshold` 時判定為 Perfect：新層寬度直接沿用 `layerWidth`（不縮減、不產生 Falling Piece），`combo += 1`，額外加分 `PERFECT_BONUS + min(combo, COMBO_BONUS_CAP) * COMBO_BONUS_STEP`；否則走 Decision 2 的一般 Block Resize 流程，並將 `combo` 歸零。`perfectThreshold` 集中於參數表管理，數值越大代表容錯範圍越寬鬆。
   - 替代方案：Perfect 判定用「重疊比例」（如 `overlapWidth / layerWidth >= 0.98`）而非絕對像素閾值——放棄，比例閾值在塔身已經縮減到很窄時（例如剩餘寬度只有個位數像素）容錯範圍會變得極度嚴苛，絕對像素閾值在整個遊戲過程中維持一致的手感，更符合「操作難度應該來自塔身變窄，而不是判定公式本身跟著變嚴苛」的設計直覺。

5. **參數集中管理於單一設定物件，計分為開放式（塔高 × 基礎分＋Perfect／Combo 加成），`maxReasonableScore()` 採寬鬆估算**
   - 理由：需求明確列出 `blockSpeed`／`speedIncrease`／`perfectThreshold`／`maxSpeed` 需要集中管理；計分沒有像 BATTLESHIP 那樣「精確可計算的固定上限」，比照多數既有遊戲（開放式計分）的既定估算慣例處理 anti-cheat 上限。
   - 做法：`TOWER_STACK_CONFIG`（比照 BREAKOUT 的 `LEVELS` 常數陣列集中管理精神）收斂 `blockSpeed`（初始移動速度）、`speedIncrease`（每次成功疊放的速度增量）、`maxSpeed`（速度上限）、`perfectThreshold`（Perfect 判定像素閾值）、`baseScorePerLayer`（每層基礎分）、`perfectBonus`／`comboBonusStep`／`comboBonusCap`（Perfect 與 Combo 加分公式）於同一個常數物件，`towerStackEngine.ts` 與頁面共用，不重複硬編碼。分數 = 每次成功疊放（含 Perfect）的 `baseScorePerLayer` 累加，加上每次 Perfect 額外的 Combo 加成；此為開放式計分，沒有理論上限。
   - 初始估算（程式碼常數，上線後可依實測調整）：`blockSpeed: 2.2`（px/tick，`TICK_MS=16`）、`speedIncrease: 0.08`、`maxSpeed: 5.5`、`perfectThreshold: 6`（px）、`baseScorePerLayer: 10`、`perfectBonus: 10`、`comboBonusStep: 8`、`comboBonusCap: 10`（即 Combo 加成封顶，避免極端連續 Perfect 局分數失控）。抓「一場優秀表現（塔高約 40 層、其中約 15 次 Perfect）≈ 700 分、換算 ≈ 100 coin」作為目標校準：`coinRate: 0.14`、`coinCapPerRun: 110`、`coinDailyCap: 100000`（沿用全遊戲統一慣例）、`maxReasonableScore(): 20000`（開放式計分的寬鬆防呆上限，比照其他無固定天花板遊戲的估算慣例，不是理論精確值）。
   - 替代方案：比照 BATTLESHIP 抓精確數學上限——放棄，塔高與 Combo 疊加沒有像戰艦「命中格數必然等於船體總格數」那樣的封閉公式，開放式計分只能抓寬鬆估算，比照大多數既有遊戲的既定做法。

6. **渲染沿用既有 DOM/CSS 慣例，不引入 Canvas（使用者已拍板確認，記錄需求落差）**
   - 理由：原始需求開發原則寫「Canvas / Pixel Shape」，但全專案十六款遊戲皆為 DOM/CSS + `v-for`／絕對定位渲染，零 `<canvas>`、零 `requestAnimationFrame`；引入 Canvas 會是全專案架構首例，需要額外的繪圖工具鏈與座標系統，與「低美術需求、不引入不必要 dependency」的專案規範方向相反。
   - 做法：塔身各層與移動中的方塊皆用 `position: absolute` 的 CSS 矩形元素 + `v-for` 渲染，比照 BREAKOUT 的磚塊／擋板渲染模式；塔身超出可視高度時，用 CSS `transform: translateY()` 對整個塔身容器做「鏡頭下移」（隨塔越疊越高，容器整體往下平移，讓最新一層維持在畫面中上方可視範圍），純 CSS transition，不需要真的捲動 DOM 節點位置。
   - 這一點與需求原文字面「Canvas」有落差，使用者已確認採用「沿用 DOM/CSS」方案定案。

## Risks / Trade-offs

- [風險] 「新方塊寬度沿用上一層寬度」（Decision 2）會讓塔身寬度單調遞減、遊戲後期容錯空間越來越小——因應：這是需求明確描述的核心玩法（「重疊越少，塔越窄」），屬於預期難度曲線而非 bug；`perfectThreshold` 為固定像素值（非比例），可避免判定公式本身隨塔身變窄而額外變嚴苛（見 Decision 4）。
- [風險] Falling Piece 若在快速連續操作下短時間內大量產生／未即時清除，可能造成 DOM 節點數量暫時堆積——因應：由於掉落碎片一次只會有一個（Decision 3 已說明偏移只會產生單側懸空矩形），且有「離開舞台即移除」與「生命週期上限」雙重清除機制，數量不會無限累積。
- [風險] `maxSpeed` 若設定過高，塔身變窄到個位數像素寬度時，移動方塊來回反彈的視覺可能出現肉眼難以判讀的抖動——因應：`maxSpeed` 集中於 `TOWER_STACK_CONFIG` 管理，上線後可依實測調整，不影響架構本身。
- [風險] 開放式計分（Decision 5）沒有精確理論上限，`maxReasonableScore()` 只能抓寬鬆估算，理論上極端熟練玩家可能打出遠超估算值的分數——因應：這是多數既有開放式計分遊戲共同的既知限制，非本次新增風險，上線後可依實測分佈調整常數。
- [風險] 塔身容器用 CSS `transform: translateY()` 做鏡頭下移，若層數極多（塔非常高）可能讓 `translateY` 數值變得很大——因應：屬於 CSS 數值層級的效能疑慮，非邏輯正確性風險，且遊戲會在極早期就因操作失誤而 Game Over，實務上塔身極高的情境機率很低。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成獨立的 `gameKey: 'towerStack'`，不影響既有十六款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/towerStackEngine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試 Overlap Detection／Block Resize／Perfect／Combo 規則）
  6. 遊戲頁面 `app/pages/game/tower-stack.vue`（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `GameMachineCard.vue`（透過 `gameSprites.ts`）+ `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- ~~Canvas vs DOM/CSS 渲染~~ **已拍板**：沿用全專案既有的 DOM/CSS 渲染慣例，不引入 Canvas。
- `perfectThreshold`／`blockSpeed`／`speedIncrease`／`maxSpeed`／計分公式常數（Decision 5）皆為程式碼估算值，上線後是否需要先做內部試玩再校準，或先上線收集實測分數分佈再調整？
- 塔身「鏡頭下移」的視覺呈現（Decision 6）是否需要額外的下方漸層／模糊效果讓過去層數有「遠景」層次感，或維持最單純的純位移即可（本次 MVP 傾向後者）？
- 是否需要在本次 MVP 就提供「塔身寬度接近 0（例如剩餘寬度 < 某個像素值）」的額外警示視覺（例如變色提示），或留待後續 Polish 變更？
