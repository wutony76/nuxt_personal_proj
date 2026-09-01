## Context

本節逐項對照原始開發計畫要求檢查的架構面向，說明既有專案裡可直接沿用的先例、以及本次需要新建的部分。

- **Game Center（遊戲中心整合）**：`add-game-history` 已建立完整架構——client 頁面自包含（engine class + reactive 鏡像 snapshot）＋ `useGameHistory`（未登入 localStorage／已登入 API 雙模式）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）＋ `game-hall.vue`／`gameSprites.ts`／`GameHistoryDialog.vue` 三處註冊點。WHACK-A-MOLE 直接沿用此架構，不需調整。
- **Timer（計時器）**：專案沒有集中式 Game Loop composable，各遊戲各自在 `<script setup>` 用 `setInterval`/`setTimeout` 驅動。WHACK-A-MOLE 需要**三種獨立計時器**同時運作：(1) 60 秒倒數的「Game Timer」；(2) 決定下一隻地鼠何時出現的「Spawn Timer」；(3) 決定當前地鼠何時自動消失的「Lifetime Timer」。三者職責互不重疊，是本次設計的核心（見 Decision 2）。
- **Input（輸入）**：全專案零 `<canvas>`，改用 DOM + `v-for` 渲染，點擊事件綁在 DOM 元素上。WHACK-A-MOLE 的輸入單純為「點擊／觸控某個洞穴格」，比照既有慣例在洞穴格 `button` 上綁 `@click`（`click` 事件在多數瀏覽器已涵蓋觸控點按，不需要額外綁定 `@touchstart`，但為求明確符合需求「Touch」項目，仍會在同一個 handler 上明確處理 pointer/touch 觸發，避免行動裝置 300ms 點擊延遲影響反應速度判定）。
- **Random（隨機）**：需要兩處隨機：(a) 地鼠生成的洞穴位置（`Math.floor(Math.random() * emptyHoles.length)` 從目前所有空洞穴中選一個）；(b) 地鼠的存活時間與下次生成間隔（在動態計算出的上下限區間內取隨機值，見 Decision 3）。比照 `runner.vue`／`breakout.vue`／`space-invaders.vue` 的「定時＋隨機」既有模式。
- **Score（計分）**：比照 `typing.vue` 的 Combo／倍率模式，`calcMultiplier(combo)` 依 `COMBO_THRESHOLDS` 分段回傳倍率，`combo` 累加、失誤歸零，得分＝基礎分 × 當下倍率（見 Decision 4）。
- **Game State（遊戲狀態）**：`state.status` 採 `'idle' | 'playing' | 'paused' | 'gameover'` 四態（比照多數既有遊戲的既定模式），洞穴陣列（9 格）各自有獨立的 `hole.moleActive`／`hole.moleSpawnedAt` 等欄位，不與 Timer、Score 混在同一個物件裡（呼應原始計畫「Timer、Spawn、Score、Game State 分離」的開發原則，見 Decision 1）。
- **Animation（動畫）**：低美術需求，不使用外部圖片、不使用 `<canvas>`；地鼠以 CSS Shape（純色塊＋簡單五官線條，比照 MINESWEEPER／PAC-MAN 的像素風純 CSS 做法）呈現「冒出／被擊中／縮回」三種狀態的簡單 CSS transition（例如 `transform: scale()` 與 `opacity`），不做進階粒子特效或爆炸動畫。

## Goals / Non-Goals

**Goals:**
- 提供 3×3（9 格）洞穴版面，地鼠隨機出現於空洞穴，玩家點擊／觸控擊中得分。
- Spawn Timer 與 Lifetime Timer 各自獨立運作，且隨遊戲進行時間增加，地鼠存活時間動態縮短，形成「越玩越快」的難度曲線。
- Combo／倍率系統直接沿用 `typing.vue` 的 `calcMultiplier` 模式，不重新發明。
- 60 秒倒數計時，時間結束進入 Game Over，並支援 Restart／Pause。
- Game Logic（Spawn／Lifetime／Score／Combo／Game State）完全不依賴 DOM，抽到 `app/utils/whackAMoleEngine.ts`；Server 端、client 資料層、game-hall 入口比照既有十六款遊戲的慣例逐一擴充。

**Non-Goals:**
- **特殊地鼠（例如金地鼠加倍分、炸彈地鼠扣分）留待下一個變更**——本次 MVP 只有單一種類的普通地鼠，不做地鼠種類分支邏輯。
- 不做同時多隻地鼠並存（MVP 為單一地鼠回合制生成，見 Decision 1），多地鼠並發列為潛在後續擴充方向。
- 不做音效、粒子特效、Screen Shake 等進階動畫效果，僅做基本 CSS transition 視覺回饋。
- 不做排行榜／全球對戰／每日挑戰模式，計分僅記錄個人歷史最高分（沿用 `useGameHistory` 既有能力）。
- 不引入資料庫；server 端持久化沿用專案現況的 in-memory 作法。
- 不做不同棋盤大小（4×4／5×5）的可切換難度選項，本次固定 3×3。

## Decisions

1. **MVP 採「單一地鼠回合制生成」，同一時間畫面上最多只有一隻地鼠**
   - 理由：原始計畫第 4 點明確描述「一個 spawn timer（決定何時生成**下一隻**地鼠）+ 一個 lifetime timer（決定**該**地鼠多久後自動消失）」，用詞是單數，指向「同一時間只有一隻地鼠在场」的簡單模型；這也讓 Spawn／Lifetime 兩個計時器的互動關係最單純：地鼠消失（被擊中或逾時）→ 觸發 Spawn Timer 倒數 → Spawn Timer 到期 → 從全部 9 個空洞穴中隨機挑一個 → 生成新地鼠並啟動新的 Lifetime Timer → 循環。
   - 做法：`state.holes` 為長度 9 的陣列，任一時刻最多 1 個元素的 `moleActive === true`；`spawnTimerId`／`lifetimeTimerId` 各自只會有一個有效的 `setTimeout` 控制代碼，不需要處理多個地鼠的計時器陣列管理。
   - 替代方案：多隻地鼠同時並存（例如洞穴數量的 30% 隨時可能同時有地鼠）——放棄，會讓 Spawn／Lifetime 計時器需要改成陣列管理（每隻地鼠一組計時器），複雜度明顯提高，且與原始計畫用詞（單數「該地鼠」）不符；列為後續變更可選的難度擴充方向（見 Open Questions）。

2. **Spawn Timer 與 Lifetime Timer 使用兩個獨立的 `setTimeout`，資料結構上互不耦合**
   - 理由：需求明確要求「Timer、Spawn、Score、Game State 分離」，且 Spawn（決定何時出現）與 Lifetime（決定出現後多久消失）是概念上完全不同的兩件事，不應該合併成單一計時器判斷。
   - 做法：`whackAMoleEngine.ts` 內部維護 `spawnTimerId: ReturnType<typeof setTimeout> | null` 與 `lifetimeTimerId: ReturnType<typeof setTimeout> | null` 兩個獨立欄位；`scheduleSpawn()` 只負責「幾毫秒後呼叫 `spawnMole()`」，`scheduleLifetime(holeIndex)` 只負責「幾毫秒後呼叫 `expireMole(holeIndex)`（若尚未被擊中）」，兩者互不呼叫對方，只透過 Game State（`state.holes`）間接產生先後關係。Restart／Pause 時兩個計時器各自獨立 `clearTimeout`，避免殘留的舊計時器在暫停或重開後誤觸發（比照 battleship `AI_TURN` 的 `setTimeout` callback 需檢查 `state.phase` 仍為預期值的既有教訓）。
   - 替代方案：用單一 `setInterval` tick（例如每 100ms 檢查一次「是否該生成」「是否該消失」）——放棄，MINESWEEPER／SOLITAIRE 已驗證「非 tick-driven、只在事件發生時同步處理」的模式更貼近本專案既有慣例，且兩個獨立 `setTimeout` 能更精確對齊隨機出的間隔時間，不受 tick 粒度限制。

3. **難度遞增公式：地鼠存活時間上限隨「已經過的遊戲時間」線性遞減至下限值**
   - 理由：需求明確要求「時間越久地鼠出現時間越短」，需要一個「已過時間 → 目前應有的 lifetime 上限」的集中公式，避免難度曲線邏輯散落在多處。
   - 做法：集中於 `whackAMoleEngine.ts` 的常數與函式：
     - `LIFETIME_CEILING_START_MS = 1400`（遊戲開始時，地鼠最長可存活 1.4 秒）
     - `LIFETIME_CEILING_MIN_MS = 500`（下限，不再隨時間繼續縮短）
     - `LIFETIME_DECAY_PER_SEC = 12`（每經過 1 秒遊戲時間，上限減少 12ms）
     - `currentLifetimeCeiling(elapsedSec) = max(LIFETIME_CEILING_MIN_MS, LIFETIME_CEILING_START_MS - elapsedSec * LIFETIME_DECAY_PER_SEC)`
     - 實際賦予某隻地鼠的存活時間＝`randomBetween(currentLifetimeCeiling * 0.6, currentLifetimeCeiling)`，保留隨機性，避免每隻地鼠存活時間完全固定、變得可預期。
     - Spawn 間隔比照同樣公式模式做小幅同步縮短（`SPAWN_CEILING_START_MS = 900`／`SPAWN_CEILING_MIN_MS = 400`／`SPAWN_DECAY_PER_SEC = 8`），讓節奏隨時間同步變快，而不是只有地鼠變快消失、生成間隔卻沒有對應變化。
   - 替代方案：分階段（Level 1/2/3）跳躍式調整——放棄，`typing.vue` 的 `calcLevel`／`LEVEL_SCORE_THRESHOLDS` 是依分數分級，不是依時間；WHACK-A-MOLE 需求明確是「隨時間」而非「隨分數」遞增難度，線性公式比階梯式更平滑，且集中在單一函式方便日後調參。

4. **Combo／倍率系統直接沿用 `typing.vue` 的 `calcMultiplier(combo)` 模式**
   - 理由：使用者明確指示比照既有先例，不要重新發明。`typing.vue` 已驗證「`COMBO_THRESHOLDS`／`COMBO_MULTIPLIERS` 兩個平行陣列＋倒序尋找符合門檻的倍率」這個模式簡單可靠。
   - 做法：`COMBO_THRESHOLDS = [0, 5, 12, 24]`、`COMBO_MULTIPLIERS = [1, 2, 3, 4]`（與 `typing.vue` 完全相同數值，維持全專案一致的「連擊里程碑」體感），`HIT_BASE_SCORE = 10`；每次擊中地鼠：`combo += 1`、`multiplier = calcMultiplier(combo)`、`score += HIT_BASE_SCORE * multiplier`；每次 miss（見 Decision 5）：`combo = 0`、`multiplier` 回到 `COMBO_MULTIPLIERS[0]`。
   - 分數估算：60 秒內在 Spawn 間隔隨時間縮短至下限 400ms、玩家反應夠快（近乎即擊）的理想狀況下，約可觸發 70~90 次生成；若命中率高、combo 多數維持在中高倍率（平均倍率抓 2~3 倍），優秀表現估算落在 `80 次 × 10 分 × 2.5 倍 ≈ 2000` 分等級的上緣，一般優秀表現則落在數百到一千多分之間，取「一場優秀表現 ≈ 100 coin」的目標校準 `coinRate`（見 Decision 6）。

5. **點錯處理：點擊沒有地鼠的洞穴（含地鼠殘影格）判定為 miss，不加分、不扣分，但 combo 歸零**
   - 理由：需求原文「點擊錯誤位置可扣分或不加分」兩個選項皆允許，需要明確取捨並記錄。若採「扣分」，需要額外處理「分數是否可以變負」的 clamp 邏輯（例如新手連續失誤導致分數卡在 0 附近，60 秒限時內容易造成挫折感、且需要多次正確點擊才能補回），實作與體感成本皆較高；而「不加分＋combo 歸零」已經是足夠的處罰——歸零 combo 代表玩家必須重新從 `COMBO_MULTIPLIERS[0]`（1 倍）累積回高倍率，對後期高倍率時段的玩家來說懲罰感明確存在，且不需要額外的負分 clamp 邏輯，`maxReasonableScore()` 的估算也更單純（分數只增不減，見 Decision 6）。
   - 做法：`clickHole(holeIndex)`——若該格 `moleActive === true` 判定為 HIT（得分＋combo+1＋清除該格與其 Lifetime Timer＋觸發 Spawn Timer）；若該格 `moleActive === false`（含尚未生成過、或地鼠剛消失但畫面殘影 CSS transition 尚未播完的格子）判定為 MISS（`combo = 0`，不改動 `score`）。
   - 替代方案：扣固定分（例如 -5，最低 clamp 至 0）——放棄，理由如上；列為 Open Questions，未來若使用者回饋「不加分」懲罰感不足，可再調整為扣分版本，屬於數值調校，不影響架構。

6. **`coinRate`／`coinCapPerRun`／`maxReasonableScore()` 估算**
   - 理由：WHACK-A-MOLE 是開放區間計分（表現越好分數越高，沒有像 BATTLESHIP 那樣的精確數學上限），比照多數既有遊戲的「寬裕估計值」做法。
   - 估算：依 Decision 4 的分數估算，一場優秀表現約落在數百到一千多分（理論極限值估算：Spawn 間隔下限 400ms、玩家零延遲即擊、combo 全程維持最高 4 倍，60 秒內約可達 `150 次 × 10 分 × 4 倍 = 6000` 分的理論天花板，但實際人類反應速度不可能達到零延遲，屬於極端上界）。
     - `coinRate: 0.08`（優秀表現 1000~1250 分 ≈ 80~100 coin，對齊「一場優秀表現 ≈ 100 coin」的既有目標）
     - `coinCapPerRun: 150`（略高於預期優秀表現的 coin 數，留防呆餘裕）
     - `coinDailyCap: 100000`（沿用全遊戲統一慣例）
     - `maxReasonableScore(): 6000`（貼齊理論極限值，超過視為異常回報，防止竄改分數的作弊請求）
   - 這些是規劃階段的估算值，比照既有慣例，上線後應依實測數據校準。

## Risks / Trade-offs

- [風險] 60 秒限時內「單一地鼠回合制」可能讓熟練玩家覺得「同時只有一隻」不夠刺激、上限太低——因應：多地鼠並存留待後續變更依實測回饋評估（見 Open Questions），本次先驗證核心玩法可行性。
- [風險] 「不加分＋combo 歸零」的 miss 處罰對老手來說可能懲罰感不足，導致亂點也不太虧——因應：combo 歸零會實際影響後續得分效率（重新從 1 倍爬升），且是本次明確記錄的取捨（見 Decision 5），若上線後回饋懲罰不足可在後續變更調整為扣分版本。
- [風險] Spawn／Lifetime 兩個獨立 `setTimeout` 若玩家在 Pause 期間快速切換分頁或裝置休眠，需確保恢復時不會讓已經到期的舊計時器一次觸發多次 spawn——因應：比照 battleship 的既有教訓，`setTimeout` callback 內檢查當下 `state.status` 是否仍為 `'playing'` 才繼續動作，Pause／Restart 時明確 `clearTimeout` 兩個計時器代碼。
- [風險] 難度公式（Decision 3）的線性遞減參數若估算不準，可能出現「前段太簡單、後段瞬間變超快」的體感落差——因應：所有難度常數集中在 `whackAMoleEngine.ts`，上線後可依實測快速調參，不影響架構。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成獨立的 `gameKey`（`'whackAMole'`），不影響既有十六款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/whackAMoleEngine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試 Spawn／Lifetime／Score／Combo 邏輯）
  6. 遊戲頁面 `app/pages/game/whack-a-mole.vue`（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `GameMachineCard.vue`（透過 `gameSprites.ts`）+ `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- 是否要在後續變更加入「多地鼠並存」模式（例如隨難度提升，同時最多 2~3 隻地鼠並存）作為進階難度選項？本次先以單一地鼠 MVP 驗證核心玩法，留待使用者回饋後評估（見 Decision 1）。
- 「不加分＋combo 歸零」的 miss 處罰是否需要改為「扣固定分數」？屬於數值調校細節，上線後可依實測與使用者回饋調整常數，不影響架構（見 Decision 5）。
- 特殊地鼠（金地鼠加倍分／炸彈地鼠扣分）的觸發機率、視覺區分方式，留待下一個變更的 design.md 再詳細規劃，本次僅在 proposal 中列為 Non-Goal。
- 難度公式（`LIFETIME_DECAY_PER_SEC`／`SPAWN_DECAY_PER_SEC` 等常數）是否需要依「已通過的遊戲時間」以外的變數（例如當前 combo 數）做更細緻的自適應調整？屬於後續優化方向，本次先採單純的線性時間公式。
