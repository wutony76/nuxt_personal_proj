## Context

> 本節即為開發計畫「第一階段」要求的完整輸出：只分析 BREAKOUT 現有實作，不修改任何程式碼。完成後停止，等待使用者確認方案（見 Open Questions）。

### 1. BREAKOUT 與 ARKANOID 的差異

依 `app/pages/game/breakout.vue`（1062 行）實際 `reactive` state（line 230-251）盤點，BREAKOUT **已有**：單一 `paddleX`、單一 `ballX`/`ballY`（非陣列）、`bricks: Brick[]`（推測只有存在/摧毀二態）、`particles`、`score`/`level`/`lives`、完整 waiting/ready/countdown/result overlay、`rateDialogOpen`/`ruleDialogOpen`。BREAKOUT **目前沒有**：Power-Up、多次命中磚塊、移動磚塊、多球、Combo。

| 項目 | BREAKOUT（現況） | ARKANOID（本提案） |
| --- | --- | --- |
| Paddle | 單一 `paddleX`，固定寬度 | 沿用單一 `paddleX`，但 WIDE Power-Up 可暫時放大寬度 |
| Ball | 單一 `ballX`/`ballY`（scalar） | `balls: Ball[]` 陣列，支援 MULTI_BALL 同時多顆 |
| Brick | `bricks: Brick[]`，推測只有存在/摧毀二態 | 新增 `hitPoints`（Multi-Hit）、`moving`（Moving Brick）、`pattern` 佈局 |
| Power-Up | 無 | 新增 WIDE／MULTI_BALL／SLOW（3 種，MVP），FIRE 留待下一版 |
| Level System | 磚塊列數與球速上限隨關卡提高，清光整關進下一關 | 沿用「清光整關進下一關」骨架，改用 Brick Pattern 定義佈局，並在關卡門檻加入 Moving Brick |
| Score | 基礎分數（未見 Combo 機制） | 基礎分數 + Multi-Hit 層數加成 + Combo 連段倍率 |
| Game Over 判定 | 球離開場地即失去一命 | 因 Multi Ball，需所有球都離開場地才失去一命（見 Decision 5） |
| Boss / 特殊關卡 | 無 | 本次 Non-Goal，留待後續變更 |

### 2. 可重用模組

從 `breakout.vue` 現況可辨識、值得沿用（規則層面，非直接 import 現有程式碼，因其未抽出獨立檔）：

- **Ball Physics**：球的移動、牆面反彈、擋板反彈角度計算（相對擊中擋板位置決定反射角）。
- **Paddle**：鍵盤/指標移動、邊界 clamp 邏輯。
- **Collision**：球與磚塊的 AABB 碰撞偵測、球與擋板的碰撞偵測。
- **Brick**：磚塊資料結構（座標、尺寸、存活狀態）與清除判定。
- **Score**：`score`/`level`/`lives` 的 reactive state 形狀與寫入 `useGameHistory` 的既有慣例。
- **Game Loop**：`setInterval` tick 驅動 + `keydown`/`keyup` 監聽的既有全專案慣例（非集中式 composable，各頁面各自實作）。
- **Game State**：`status`（ready/playing/...）與 waiting/ready/countdown/result overlay 流程、`rateDialogOpen`/`ruleDialogOpen` 共用 dialog 掛載方式。
- **Level System**：「清光磚塊進下一關、球速上限與磚塊列數隨關卡提升」的既有規則骨架。
- **Particle**：`particles` 碎屑動畫模式，可直接沿用同樣手法呈現 Multi-Hit Brick 破裂或 Power-Up 拾取的視覺回饋。

### 3. 建議共用/獨立架構

現況：BREAKOUT 的球物理/碰撞/磚塊邏輯**內嵌在 `breakout.vue` 頁面內，並未抽出獨立 engine 檔**（不同於 `battleshipEngine.ts`／`solitaireEngine.ts` 的先例）。因此「重用」在技術上有兩條路，取捨列於 Decision 1，並列入 Open Questions 讓使用者選擇：

- **方案 (a) 現在就重構**：新增 `app/utils/breakoutEngine.ts`，把 `breakout.vue` 現有的 Ball Physics／Paddle／Collision／Brick 邏輯抽出成不依賴 Vue 的純函式/class，`breakout.vue` 與新的 `arkanoid.vue` 都改為呼叫這支共用 engine（`arkanoid.vue` 另外疊加 Multi-Hit/Moving/Power-Up/Multi Ball 的擴充邏輯）。優點：徹底消除重複程式碼、未來兩款遊戲的核心 bug 修一次就好；缺點：**必須修改現有 `breakout.vue`**，屬於對既有檔案的重構，且需要重新驗證 BREAKOUT 既有行為不能有任何回歸，風險與工作量都不小，違反「不要自行大幅重構」的開發原則，需使用者另外確認才能執行。
- **方案 (b) 先獨立實作**：新增 `app/utils/arkanoidEngine.ts`，複製 BREAKOUT 的**最小必要邏輯**（球物理公式、AABB 碰撞、擋板 clamp 等幾個純函式，估計數十行），而不是複製整個 `breakout.vue` 檔案；`breakout.vue` 完全不變動。日後若要消除重複，再回頭做方案 (a) 的抽出。優點：完全不觸碰既有檔案、風險最低、可以立刻開始實作；缺點：短期內兩份程式碼會有小範圍重複（僅限核心物理/碰撞的純函式，不包含 UI/state）。
- **方案 (c) 其他（例如折衷）**：只抽出「純數學/碰撞工具函式」（如反射角度計算、AABB 相交判定）到一支輕量的 `app/utils/gameMath.ts`，`arkanoid.vue` 直接使用；`breakout.vue` 是否改用同一支工具函式由使用者另外決定（可以本次不改、之後有空再換），不影響 `breakout.vue` 現有的 state/流程邏輯,只影響最底層、無副作用的計算函式，改動風險遠小於方案 (a) 的整體抽出。

**使用者已拍板：採用方案 (b)**——ARKANOID 獨立實作，複製最小必要邏輯，不修改 `breakout.vue`；方案 (a)/(c) 的共用重構列為未來若有需要才進行的獨立變更，本次不執行。

### 4. 新增檔案

- `app/pages/game/arkanoid.vue`
- `app/utils/arkanoidEngine.ts`
- `server/services/game/retro/arkanoid.ts`
- `server/api/games/retro/arkanoid/history.get.ts`、`history.post.ts`、`history.delete.ts`
- （條件性，僅方案 a）`app/utils/breakoutEngine.ts`

### 5. 修改檔案

本次（文件撰寫階段）**不修改任何既有檔案**。未來實作階段預期修改：

- `app/services/api.ts`（`RetroGameKey` 擴充）
- `app/composables/useGameHistory.ts`（`GAME_KEYS`／`_handlers.gameApi()` 擴充）
- `app/components/GameHistoryDialog.vue`（篩選 tab 擴充）
- `app/config/gameSprites.ts`（新增一筆，glow `#ef476f`）
- `app/pages/game-hall.vue`（新增 `id: 24` 卡片）
- `server/services/storage.ts`（遊戲初始化區塊新增註冊）
- **僅當採方案 (a)**：`app/pages/game/breakout.vue`（內嵌邏輯改為呼叫共用 engine，是本提案唯一可能觸及 BREAKOUT 本體的項目，本次不執行、需另行確認）

### 6. MVP 順序

1. Paddle / Ball / Brick 基礎骨架＋Collision（沿用 BREAKOUT 規則，先讓球能打磚塊、擋板能接球）
2. Score / Life / Game Over / Restart / Pause（比照 BREAKOUT 既有流程與 overlay 慣例）
3. Level System / Brick Pattern（改用預定義圖樣佈局取代單純列數遞增）
4. Multi-Hit Brick（`hitPoints` 遞減，最基礎的差異化項目，不牽動 state 形狀巨變）
5. Moving Brick（在既有磚塊資料結構上加移動屬性，複雜度中等）
6. Power-Up：WIDE → SLOW → MULTI_BALL（依複雜度遞增順序，FIRE 留待下一版，見 Non-Goals）
7. Multi Ball（因 MULTI_BALL Power-Up 觸發，此時才需要把 `ballX`/`ballY` 改為 `balls[]` 陣列，是本次最大的資料結構改動，见 Decision 5）
8. Combo（在核心玩法穩定後才疊加計分倍率，避免过早引入影响调试）

## Goals / Non-Goals

**Goals:**
- 提供 BREAKOUT 的進階版本：Multi-Hit Brick、Moving Brick、Brick Pattern、Power-Up（WIDE／MULTI_BALL／SLOW）、Multi Ball、Combo，明確與 BREAKOUT 做出玩法區隔。
- 沿用 BREAKOUT 已驗證的 Paddle／Ball／Collision／Level System／Overlay 流程與 `useGameHistory` 整合方式，不重新發明基礎打磚塊規則。
- Game Logic（Ball／Paddle／Collision／Brick／Power-Up／Level）不依賴 DOM，抽到 `app/utils/arkanoidEngine.ts`；Server 端、client 資料層、game-hall 入口比照既有十六款遊戲的慣例逐一擴充。
- 明確提出「共用 vs 獨立」架構方案，並在使用者確認前不擅自對 `breakout.vue` 做任何重構。

**Non-Goals:**
- 不做 Boss 戰／特殊關卡——需求明確列為「可在後續加入」，本次僅完成核心打磚塊玩法。
- Power-Up 本次只做 **WIDE／MULTI_BALL／SLOW 3 種**，**FIRE 留待下一版**——需求明確要求「不要一次加入大量 Power Up，先完成 2～3 種」。
- 不執行「抽出 BREAKOUT 共用 engine」的重構本身——本次只提出方案 (a)/(b)/(c)，交由使用者於 Open Questions 決議，不自行大幅重構既有檔案。
- 不修改 `app/pages/game/breakout.vue` 或任何其他既有 16 款遊戲的程式碼與行為。
- 不做音效／BGM／外部美術素材——比照專案「低美術、不使用外部圖片」的既定原則，沿用 DOM/CSS 像素風格。
- 不做線上排行榜以外的额外社交功能，沿用既有 `useGameHistory` 機制。

## Decisions

1. **共用/獨立架構：使用者已拍板採方案 (b) 獨立實作，方案 (a) 抽出共用 engine 不在本次執行**
   - 理由：方案 (a) 需要修改 `breakout.vue` 本體，屬於對既有檔案的重構，違反「不要自行大幅重構」「不修改無關遊戲程式碼」的開發原則；方案 (b) 完全不觸碰既有檔案，可以立刻開始實作，風險最低。使用者已於 Open Questions 確認採用此方案。
   - 做法：`app/utils/arkanoidEngine.ts` 獨立撰寫球物理/碰撞/磚塊等純函式，允許與 `breakout.vue` 內嵌邏輯有小範圍（僅限核心公式，非整份檔案）重複；若未來有需要消除重複，再另開變更處理重構與回歸測試。
   - 替代方案：方案 (a)／(c)——保留為未來若有需要才進行的獨立變更，本次不執行。

2. **Multi-Hit Brick 資料結構：磚塊新增 `hitPoints`，命中遞減至 0 才摧毀**
   - 理由：需求核心玩法要求「多種特殊 Brick」，Multi-Hit 是最基礎、對既有 `Brick` 資料結構改動最小的一種（只加一個數值欄位，不改變陣列形狀）。
   - 做法：`Brick` 型別新增 `hitPoints: number`（初始值 1～3，依關卡與 Pattern 決定），每次球擊中該磚塊執行 `hitPoints -= 1`；`hitPoints <= 0` 時才視為摧毀、觸發 `particles` 碎屑與計分；`hitPoints > 0` 時磚塊維持存在，僅切換視覺樣式（依剩餘層數變色/顯示裂痕），不消耗生命或影響球的反彈方向（反彈規則與現有摧毀式磚塊相同）。
   - 替代方案：用「磚塊種類」列舉（一般/堅固/超堅固）取代數值——放棄，數值型 `hitPoints` 更利於未來擴充關卡設計工具與美術分層,且遞減邏輯比條件分支更單純。

3. **Moving Brick 移動範圍限制：僅在磚塊自身所屬欄位範圍內水平來回移動**
   - 理由：磚塊區域是固定網格佈局，若允許自由移動容易與其他磚塊重疊或超出磚塊區域邊界，增加碰撞判定複雜度且可能造成視覺穿模。
   - 做法：`Brick` 型別新增可選欄位 `moving?: { minX: number; maxX: number; speed: number; direction: 1 | -1 }`；每個 tick 更新 `x`，碰到 `minX`/`maxX` 邊界即反向；`minX`/`maxX` 由關卡佈局在該磚塊「原本所屬欄位」的左右鄰近空格範圍內預先計算，確保不會移動到其他磚塊的格子上；移動磚塊在關卡進度達門檻後才出現（見 MVP 順序第 5 步），且與 Multi-Hit 可疊加（一個磚塊可以同時是「會移動」且「需多次命中」）。
   - 替代方案：允許磚塊在整個磚塊區域內自由飄移——放棄，需要額外的磚塊間避讓演算法，複雜度與本次 MVP 範圍不成比例。

4. **Power-Up 掉落/拾取/生效時長機制：磚塊摧毀時機率掉落膠囊，擋板接住即生效，WIDE/SLOW 限時、MULTI_BALL 即時**
   - 理由：需求明確要求 Power-Up 為「WIDE / MULTI_BALL / SLOW / FIRE」，本次先做 2～3 種（WIDE／MULTI_BALL／SLOW），機制需簡單可靠，不引入額外拖曳/瞄準操作。
   - 做法：磚塊被摧毀（`hitPoints` 歸零）時，依固定機率（設計估算 15%）產生一個掉落中的膠囊物件（`{ type, x, y }`），以固定速度垂直下落；擋板與膠囊的碰撞判定沿用「Collision」可重用模組的 AABB 邏輯；接住後依 `type` 生效：
     - `WIDE`：擋板寬度暫時放大（例如 x1.5），效果持續 8 秒，倒數期間 HUD 顯示效果圖示與剩餘時間；同類型效果重疊拾取時重置倒數（不疊加時長）。
     - `SLOW`：所有球的移動速度暫時降低（例如 x0.6），同樣持續 8 秒、同類型重置倒數規則。
     - `MULTI_BALL`：即時生效（無持續時間），依當前存活球數各自複製出 1 顆新球（初始位置與原球相同、方向對稱分裂），使 `balls[]` 陣列增加，直到達到本次設計上限（建議 4 顆，避免畫面過於混亂與效能疑慮，DOM 渲染方式下球數不宜過高）。
   - 未接住的膠囊落到場地底部即消失，不影響生命值（膠囊不是磚塊也不是球，漏接沒有懲罰，只是錯失獎勵）。
   - 替代方案：Power-Up 需要玩家額外操作才能使用（如按鍵觸發）——放棄，需求描述是「掉落拾取」模式，即時生效更貼近經典 Arkanoid 的體驗，操作也更單純。

5. **Multi Ball：`ballX`/`ballY` 改為 `balls: Ball[]` 陣列，Game Over 判定需所有球都離開場地才失去一命**
   - 理由：BREAKOUT 現況是單一 scalar `ballX`/`ballY`，只要支援 Multi Ball 就必然要改成陣列，這是本次差異化項目中對既有資料形狀影響最大的一項，需要明確記錄，避免實作階段誤判「漏一顆球未落地就扣命」。
   - 做法：`arkanoidEngine.ts` 內部維護 `balls: Ball[]`（每顆球有自己的 `x`/`y`/`vx`/`vy`/`launched`），初始狀態僅 1 顆；MULTI_BALL Power-Up 生效時往陣列 push 新球；每個 tick 對陣列內每顆球分別執行牆面反彈、擋板碰撞、磚塊碰撞；當某顆球的 `y` 超出場地底部即從陣列移除該顆球；**只有當 `balls.length === 0`（所有球都已離開場地）才觸發失去一命與重新發球流程**，不像 BREAKOUT 現況「唯一一顆球落地」等同「失去一命」那樣單純。
   - Combo 計數與各顆球獨立命中無關，採全域共用一份 Combo 計數（任一顆球命中磚塊都會累加同一份 Combo，不分球別），簡化計分邏輯，避免多球同時命中時的競態順序問題。
   - 替代方案：Multi Ball 期間仍用單一「代表球」座標、其餘球只做視覺效果不參與判定——放棄，這樣無法真正達成「多球同時打磚塊」的核心體驗，且會讓 Power-Up 的價值大打折扣。

6. **Combo 與 coinRate 校準：連段倍率提升分數上限，`maxReasonableScore()`／`coinRate` 需比照 BREAKOUT 重新估算**
   - 理由：Multi-Hit 加成、Power-Up 加分與 Combo 倍率疊加後，ARKANOID 單局的理論分數上限會明顯高於 BREAKOUT 的基礎計分，若沿用 BREAKOUT 現有的 `coinRate` 設定，會偏离「一場優秀表現 ≈ 100 coin」的既有校準目標。
   - 做法（設計階段估算值，比照全專案慣例，上線後應實測校準）：`coinDailyCap: 100000`（沿用全遊戲统一慣例）；抓一場優秀表現（多關破關、觸發多次 Combo 與 Power-Up）粗估分數落在 8000～12000 區間，設定 `coinRate: 0.01`（約 80～120 coin，貼近既有「≈100 coin」目標）；`coinCapPerRun: 150`（略高於估算上限，防呆留餘裕）；`maxReasonableScore(): 20000`（比粗估上限再留一倍緩衝，因 Combo／Multi-Hit／Power-Up 疊加下實際上限不像 BATTLESHIP 那樣可精確計算，需保守抓寬裕值）。
   - 替代方案：沿用 BREAKOUT 現有 `coinRate` 數值——放棄，Combo 與 Power-Up 加成會讓分數量級偏高，直接沿用舊數值會導致 coin 發放過多。

## Risks / Trade-offs

- [風險] 方案 (b)（獨立實作）會讓 BREAKOUT 與 ARKANOID 的核心物理/碰撞公式短期內有小範圍重複——因應：僅限底層純函式（估計數十行），不重複整份檔案或 state 邏輯；若使用者選擇方案 (a) 或 (c)，可在後續變更中收斂，不影響本次 MVP 上线。
- [風險] Multi Ball 的「所有球都離開場地才失去一命」判定，若實作疏忽（例如沿用 BREAKOUT 舊有的單球判定邏輯）容易誤判提前扣命——因應：design 已在 Decision 5 明確記錄，實作階段需針對「MULTI_BALL 生效中失去部分球但非全部」的情境專門測試。
- [風險] Moving Brick 與 Multi-Hit Brick 疊加後，碰撞判定需要同時處理「移動中的磚塊位置」與「剩餘 hitPoints」，複雜度高於單一差異化項目——因應：MVP 順序（Context 第 6 項）刻意把 Multi-Hit 排在 Moving Brick 之前，先驗證單一機制正確，再疊加第二種。
- [風險] Power-Up 掉落機率／持續時間／MULTI_BALL 球數上限等數值都是設計階段估算值，可能需要多輪調優——因應：比照全專案慣例，上線後依實測調整常數，不影響架構本身。
- [風險] Combo／Power-Up 疊加後的分數上限難以像 BATTLESHIP 那樣精確計算，`maxReasonableScore()` 只能保守估算——因應：Decision 6 已預留一倍緩衝，上線後應實測校準，避免過嚴擋下正常高分或過鬆讓異常值蒙混過關。

## Migration Plan

- 全新功能，無既有資料需要遷移，`gameKey: 'arkanoid'` 為獨立鍵值，不影響既有 16 款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照 BATTLESHIP 先例的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/arkanoidEngine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試 Ball/Brick/Power-Up 規則）
  6. 遊戲頁面 `app/pages/game/arkanoid.vue`（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `GameMachineCard.vue`（透過 `gameSprites.ts`）+ `GameHistoryDialog.vue`（此步驟起使用者才看得到入口）
- 若使用者於 Open Questions 選擇方案 (a)：需另外插入一個獨立的前置步驟——先抽出 `app/utils/breakoutEngine.ts` 並完整回歸測試 BREAKOUT 既有行為無誤，才能讓 `arkanoid.vue` 依賴它；此步驟建議獨立成另一個 OpenSpec 變更處理，不與本次 ARKANOID 上線步驟混在一起，避免 BREAKOUT 的回歸風險拖慢 ARKANOID 的上線時程。

## Open Questions

- ~~共用/獨立架構最終決議~~ **已拍板（方案 b）**：ARKANOID 獨立實作，複製最小必要邏輯但不複製整份檔案，不動 `breakout.vue`；日後若有需要再回頭評估方案 (a)/(c)。
- FIRE Power-Up 的具體效果（例如球體暫時可穿透磚塊而不反彈）留待下一版變更詳細規劃，本次僅在 Non-Goals 中列為延後項目。
- Boss／特殊關卡的觸發時機與玩法細節，留待後續變更的 design.md 再詳細規劃。
- Multi Ball 上限（本設計估算為 4 顆）是否需要依關卡調整，或維持全關卡統一上限，屬於數值調校細節，可在實作階段依實測手感微調。
- Combo 倍率的具體門檻與倍數（例如連 5 下 x1.2、連 10 下 x1.5）留待實作階段細部設計，本次僅確定「有 Combo 機制、碰到擋板或失去一命即重置」的規則方向。
