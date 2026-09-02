## Context

> 本節分析現有遊戲慣例與使用者提供的完整 TD 設計規格之間的落差，找出需要收斂/取捨的架構決策。使用者已提供非常明確的玩法/數值/波次設計，本設計文件的主要工作是「把使用者規格對應到本專案的既有技術慣例」，而非重新設計玩法本身。

### 1. 現有遊戲慣例盤點

檢視最新一款遊戲 `app/pages/game/arkanoid.vue`（1010 行）與 `app/utils/arkanoidEngine.ts`，並抽查 `battleship.vue`（976 行）、`tower-stack.vue`（971 行）：

- **全專案 20+ 款遊戲無例外採用「單一頁面 `.vue` + 單一 `xxxEngine.ts`」模式**，`app/components/` 底下**沒有任何**遊戲拆出子元件（`GameHUD.vue`／`TowerMenu.vue` 之類的子元件在既有專案中完全不存在），共用元件僅有 `GameHallSprites.vue`／`GameHistoryDialog.vue`／`GameMachineCard.vue`／`GameRuleDialog.vue`／`GameRateDialog.vue` 這類跨遊戲的大廳/紀錄基礎設施。
- `app/utils/` 底下每款遊戲固定只有**一個** engine 檔（`arkanoidEngine.ts`／`battleshipEngine.ts`／`towerStackEngine.ts`…），**沒有任何一款遊戲把 engine 拆成多檔**，即使是機制數量與 TD 相當的 ARKANOID（Multi-Hit／Moving Brick／3 種 Power-Up／Multi Ball／Combo 五種機制）也全部塞在同一支 `arkanoidEngine.ts`。
- Game loop 一律用 `setInterval`（`TICK_MS` 依遊戲手感調整，ARKANOID 用 16ms），非 `requestAnimationFrame`；輸入用 `keydown`/`keyup` 或 `click`，計時器存成模組層 `let xxxTimer`，`onUnmounted`/停止時統一清除。
- Server 端固定「共用基底類別 `RETRO_GAME_BASE` + 每款遊戲一個服務檔」，新遊戲上線需在 8 個既有位置註冊（見 tasks.md 第 1～7 節）。

### 2. 與使用者原始構想的落差

使用者在需求中提出的「程式架構」建議：

```
Game/ (GameState, WaveSystem, EnemySystem, TowerSystem, ProjectileSystem, EconomySystem, UpgradeSystem)
UI/ (GameHUD, TowerMenu, TowerInfo, UpgradeChoice)
Entities/ (Enemy, Tower, Projectile)
Map/ (GameMap)
```

這是「多資料夾、多檔案」的模組化構想，但與**全專案無例外的單檔慣例**不符。使用者需求本身也明確要求「不要過度工程化」「不要為了架構一次做太多東西」「保持模組化但避免過度工程化」——因此本設計採**折衷**：保留使用者要的邏輯分層（Wave/Enemy/Tower/Projectile/Economy/Upgrade 各自獨立、職責單一），但**物理上收斂成單一 engine 檔**，用具名 class 達成模組化，UI 也不拆子元件，完全比照 ARKANOID 先例。見 Decision 1。

### 3. 新增檔案

- `app/pages/game/tower-defense.vue`
- `app/utils/towerDefenseEngine.ts`
- `server/services/game/retro/towerDefense.ts`
- `server/api/games/retro/tower-defense/history.get.ts`、`history.post.ts`、`history.delete.ts`

### 4. 修改檔案

本次（文件撰寫階段）**不修改任何既有檔案**。未來實作階段預期修改：

- `app/services/api.ts`（`RetroGameKey` 擴充）
- `app/composables/useGameHistory.ts`（`GAME_KEYS`／`_handlers.gameApi()` 擴充）
- `app/components/GameHistoryDialog.vue`（篩選 tab 擴充）
- `app/config/gameSprites.ts`（新增一筆，`icon: '🏰'`、`anim: 'blink'`、`glow: '#6a994e'`）
- `app/pages/game-hall.vue`（新增 `id: 25` 卡片）
- `server/services/storage.ts`（遊戲初始化區塊新增註冊）

### 5. MVP 順序（沿用使用者指定的 10 個 Phase，逐一對應到本次架構）

1. 敵人沿路徑移動（`EnemySystem` 骨架＋固定路徑座標陣列，先無塔無戰鬥，純驗證 DOM + `transform` 移動手感）
2. 塔放置（`TowerSystem` 骨架，點格子建塔，路徑格禁建，草地格 hover 高亮）
3. 塔自動攻擊（`TowerSystem` 索敵＋冷卻判定）＋`ProjectileSystem`（固定飛行時間、終點結算傷害，見 Decision 4）
4. `EconomySystem`（Gold）／HP／`WaveSystem`（Wave 顯示與基礎迴圈）打通，敵人抵達終點扣血
5. 塔升級（3 級數值表，`UpgradeSystem` 的塔升級部分，見 Decision 2）
6. 四種敵人差異化（普通/快速/Tank，Boss 留到 Phase 8）
7. Wave 強化選擇 UI（`UpgradeSystem` 的波次強化部分，見 Decision 5）
8. Boss 機制＋無限波（Endless）：第 1～20 波沿用手工 `WAVE_TABLE`（Boss 於 10、20 波出現），第 21 波起接上程序化 `WaveGenerator`，難度持續遞增、Boss 每 10 波重複出現、永不設終點（見 Decision 6／Decision 9）
9. 數值平衡與手感調整（本文件數值皆為設計階段估算值，此階段依實測微調）
10. 像素風 UI 收尾（黑色描邊、pixel font、簡單特效）

每個 Phase 完成後才進入下一階段，不在單一 Phase 混做多件事。

## Goals / Non-Goals

**Goals:**
- 交付一個「好玩」的 TD MVP：可放塔、自動攻擊、擊殺取得 Gold、建造與升級、Wave 逐漸變難、玩家需要思考塔位與升級方向、死亡後有動機重玩。
- 全程 DOM + CSS 呈現，不使用 Canvas/WebGL；移動優先用 `transform`，避免頻繁修改 `top`/`left`/`width`/`height`。
- 遊戲規則邏輯（Enemy/Tower/Projectile/Wave/Economy/Upgrade）不依賴 DOM，集中在 `app/utils/towerDefenseEngine.ts`；Server 端、client 資料層、game-hall 入口比照既有 24 款遊戲的慣例逐一擴充。
- 難度曲線透過「敵人數量／速度／組成／出怪節奏／Boss」交織提升，不單純堆 HP；第 1～20 波清楚分段（1-3 易懂／4-7 開始思考／8-9 有壓力／10 首個 Boss 考驗 Build／11-15 明確策略／16-20 高壓挑戰），第 21 波起由程序化生成器接手延續同一組難度維度、持續遞增。
- Wave 強化系統讓每局的成長方向不同（高攻擊流／高攻速流／經濟流／控制流／射程流）。
- **無限波（Endless）**：不設破關終點，唯一結束條件是 HP 歸零；玩家的核心目標是「盡量撐到更高的波次」，`waveReached` 是主要成就與重玩驅動力，取代傳統 TD「打完 N 波就贏」的設計。

**Non-Goals（使用者已明確排除，第一版不做）：**
- 複雜 ECS 架構、完整存檔系統、帳號系統、獨立排行榜（沿用既有 `useGameHistory`，非新排行榜）、商店、抽卡、任務、成就、裝備系統、角色系統、多地圖、多模式。
- 地圖編輯器；第一版僅 1 張固定地圖。
- 保證存在一個所有玩家都必然能通過的「必勝上限」；無限波刻意設計為難度終將超過玩家防禦力，這是預期行為（能撐到多高的波次本身就是遊戲目標），不是需要修正的問題。
- 手機版操作最佳化；桌面滑鼠操作優先。
- 高品質角色美術、複雜動畫、大量粒子特效、3D、漸層 UI、玻璃效果、SaaS 卡片風、過度圓角、複雜背景——沿用專案既定的「極簡像素風：方塊＋黑色描邊＋Pixel Font＋有限色彩＋簡單動畫」。
- 音效／BGM／外部美術素材，沿用「不使用外部圖片」原則，圖示以 emoji／CSS 方塊呈現。

## Decisions

1. **架構收斂：邏輯分層在單一 engine 檔內用 class 達成，不拆多資料夾/多元件**
   - 理由：全專案 20+ 款遊戲（含機制數量相當的 ARKANOID）無例外採「單頁 + 單 engine 檔」，拆成使用者原始構想的 `Game/`／`UI/`／`Entities/`／`Map/` 多資料夾會是本專案的第一個例外，違反「避免過度工程化」「保持程式碼容易維護」原則本身也強調的一致性；且 Nuxt file-based routing／既有 8 處註冊點（見 tasks.md）都是以「一個頁面檔案」為單位設計，拆頁面反而增加維護成本。
   - 做法：`app/utils/towerDefenseEngine.ts` 單一檔案內，依使用者要求的職責分層，定義 `EnemySystem`／`TowerSystem`／`ProjectileSystem`／`WaveSystem`／`EconomySystem`／`UpgradeSystem` 等具名 class（各自持有自己的資料與方法，互不直接操作對方內部狀態），最上層 `TowerDefenseEngine` class 組合這些子系統、提供 `tick()`／`reset()`／`getSnapshot()`／`placeTower()`／`upgradeTower()`／`chooseWaveUpgrade()` 等對外方法；`tower-defense.vue` 只呼叫這些公開方法並鏡像 `getSnapshot()` 到 `reactive()` state，不直接碰子系統內部。UI 同樣不拆子元件，HUD／塔選單／塔資訊／強化選擇 Modal 都是同一個 `.vue` 檔案內的區塊（用 `<template>` 內的區塊劃分＋各自的 `computed`），比照 ARKANOID 的 waiting/ready/countdown/result overlay 寫法。
   - 替代方案：完全比照使用者原始構想拆多資料夾多檔案——放棄，會是全專案唯一例外，且 20 波＋3 塔＋4 敵人＋5 強化的規模仍在單檔可維護範圍內（預估 engine 檔 600～900 行、頁面檔 900～1200 行，與 ARKANOID 相近量級）。

2. **塔升級：每塔固定 3 級，數值表直接寫死在 engine 內的常數區，不做動態平衡**
   - 理由：需求明確要求「每種塔至少 3 級，升級至少影響 Damage/Attack Speed/Range/特殊能力」且「升級價格需要讓玩家做決策」。
   - 做法（設計階段估算值，Phase 9 依實測調整）：

     | 塔 | Lv | 傷害 | 攻速(次/秒) | 射程(格) | 特殊 | 花費 |
     |---|---|---|---|---|---|---|
     | 弓箭塔 | 1/2/3 | 8/14/22 | 1.2/1.5/1.8 | 3.5/4/4.5 | Lv3 10% 機率暴擊 x2 | 建 50／升 80／升 150 |
     | 炮塔 | 1/2/3 | 25/40/60（範圍傷害） | 0.6/0.7/0.8 | 3/3.2/3.5 | Lv3 濺射附帶 0.3s 短暫遲滯 | 建 80／升 120／升 200 |
     | 冰塔 | 1/2/3 | 3/5/8 | 1.0/1.1/1.2 | 3/3.3/3.6 | 減速 20→30→40%；Lv3 被減速敵人額外承傷 +10% | 建 60／升 90／升 160 |

     升級花費刻意設計成「單次升級成本接近甚至超過玩家當下常見存量」（例如玩家有 180 Gold 時升級要 150），迫使玩家在「現在升級」與「存錢應付下一波/多蓋一座塔」之間取捨，不做成線性小額升級。
   - 替代方案：升級無上限、價格隨等級線性遞增——放棄，需求明確要求「不要讓玩家可以無腦把所有塔都升滿」，固定 3 級 + 陡峭花費曲線更容易控制節奏。

3. **地圖：CSS Grid 12×8，路徑用有序座標陣列定義，第一版僅 1 張固定圖**
   - 理由：需求明確允許「地圖可以使用 CSS Grid」「第一版只需要 1 張簡單地圖」「不需要地圖編輯器」。
   - 做法：`towerDefenseEngine.ts` 內定義 `MAP_LAYOUT`：一個 12×8 的 cell 型別陣列（`'path' | 'grass'`）＋一個有序 `PATH_WAYPOINTS: {row, col}[]` 供敵人依序移動；起點/終點各佔一格並用 emoji（🏁/🏰）標示；`grass` 格才能建塔，`path` 格點擊建塔請求會被 `TowerSystem.canPlace()` 拒絕並給予 UI 提示。
   - 替代方案：用像素座標自由放置塔（非格子吸附）——放棄，Grid 吸附更符合「極簡像素風」且大幅簡化「塔是否可放置」的判定邏輯。

4. **子彈/攻擊判定簡化：不做真實飛行碰撞，改用「固定飛行時間 + 終點結算」**
   - 理由：需求強調「因為禁止 Canvas，特別注意 DOM 數量」「避免大量頻繁修改 top/left/width/height」；真實飛行碰撞（子彈與移動中敵人的即時位置比對）在 DOM 方案下計算量與重繪次數都偏高。
   - 做法：塔命中判定在**發射當下**用敵人當前位置做範圍/單體判定並直接鎖定傷害結果；子彈本身只是純視覺元素——用 `transform: translate()` 在固定時間（依塔到目標的距離換算，通常 100～250ms）內從塔移動到目標當下座標，動畫結束後自動移除該 DOM 節點；傷害結算與 Gold/HP 變動在**發射當下**就已經確定，不等子彈動畫播完（避免子彈飛行中目標被其他塔擊殺導致的競態問題）。炮塔範圍傷害用一次性 CSS animation 爆炸特效 div，播完自動移除。
   - 替代方案：子彈飛行途中即時偵測是否命中移動中的敵人——放棄，DOM 環境下逐幀比對子彈與所有敵人座標的計算/重排成本不成比例，且「發射當下鎖定目標」對玩家體感差異極小。

5. **Wave 強化系統：每波清完，從固定 5 選項池隨機抽 3 個供玩家選 1，效果可疊加**
   - 理由：需求列出 5 個具體選項（攻擊力+15%／攻速+15%／Gold收益+20%／射程+15%／減速+20%），並強調「希望玩家每一局的成長方向都不完全相同」。
   - 做法：`UpgradeSystem` 維護一組全域倍率（`globalDamageMult`／`globalAtkSpeedMult`／`goldMult`／`globalRangeMult`／`slowMult`，初始皆為 1），每波清完（`WaveSystem` 判定該波敵人與生成佇列皆清空）從 5 個選項中隨機抽 3 個顯示，玩家選 1 後對應倍率疊乘（例如選 2 次攻擊力 +15% → `globalDamageMult = 1.15 * 1.15`）；下一波開始前必須完成選擇（不可跳過，強化選擇本身就是「玩家持續思考」的核心循環一環，符合需求「這個系統非常重要」的定位）。
   - 替代方案：強化選項固定順序出現，不做隨機抽選——放棄，隨機 3 選 1 更能製造「每局不同」的重玩動機，且不影響實作複雜度。

6. **Boss 與難度曲線：第 1～20 波手工設計，第 21 波起程序化生成，Boss 每 10 波固定重複出現**
   - 理由：需求原始 20 波難度表已明確要求「不要讓難度只是單純增加 HP」，使用者後續要求波次改為無限；手工設計每一波在無限模式下不可行，需要一個「前段手工教學曲線 + 後段公式化延伸」的組合。
   - 做法（設計階段估算值，Phase 9 依實測調整）：

     | 敵人 | 基礎 HP | 速度倍率 | 擊殺獎勵 |
     |---|---|---|---|
     | 普通怪 | 30 | 1.0x | 5 Gold |
     | 快速怪 | 15 | 1.8x | 4 Gold |
     | Tank | 120 | 0.6x | 12 Gold |
     | Boss（每 10 波） | 依 Boss 序號成長，見下 | 0.5x（HP<30% 時加速 20%） | 100 Gold |

     **第 1～20 波（`WAVE_TABLE`，手工設計）**：每波實際 HP＝基礎 HP × `(1 + 0.10 × (wave - 1))`，難度主要來自出怪數量（wave1 約 8 隻 → wave19 約 30+ 隻）、出怪間隔（wave1 約 1.2s → wave15+ 壓到 0.6s）、敵人組成比例（Tank/快速怪佔比逐步提高）、以及第 9 波「敵人整體速度 +10%（不加血）」這類單一維度突襲，對應使用者原始需求的 Wave 1～20 描述；wave10 出現第 1 隻 Boss（HP 800，含護衛怪）。

     **第 21 波起（`WaveGenerator`，程序化）**：延續同一組難度維度，用公式持續遞增而非查表——
     - 出怪數量：`count(wave) = min(baseCount + Math.floor((wave - 20) * 1.5), MAX_SPAWN_PER_WAVE)`（`MAX_SPAWN_PER_WAVE` 見 Decision 9 效能上限）
     - 出怪間隔：`interval(wave) = Math.max(MIN_SPAWN_INTERVAL, 1.2 - wave * 0.01)`（`MIN_SPAWN_INTERVAL` 建議 0.35s，避免間隔趨近 0 造成瞬間大量生成）
     - 敵人組成：Tank／快速怪佔比隨波次線性提高並封頂（例如 Tank 佔比 `min(0.1 + (wave-20)*0.01, 0.4)`），避免後期組成單一化
     - HP：沿用 `(1 + 0.10 × (wave - 1))` 同一條成長曲線，不因進入程序化階段而變動斜率，確保 20/21 波交界難度平滑銜接
     - **Boss（每 10 波，wave 10/20/30/40…）**：`bossIndex = wave / 10`，`bossHP(bossIndex) = 800 × 1.6^(bossIndex - 1)`（wave10=800、wave20=1280、wave30=2048…等比成長，取代原本 wave10/wave20 兩個寫死數值），擊殺獎勵維持 100 Gold 不隨 Boss 序號成長（避免後期經濟失控，Gold 成長交給 Wave 強化的 Gold 收益選項）
   - 替代方案 1：Boss 只出現一次（wave20 或最後一波）——放棄，需求明確要求 wave10 也要有 Boss，且無限模式下「Boss 每 10 波重複出現」比「只有最後一戰」更符合 Endless 玩法的節奏感。
   - 替代方案 2：完全捨棄手工 `WAVE_TABLE`，第 1 波就用程序化公式生成——放棄，公式在波次很小時（wave1-5）容易產生不直覺的數字（例如極少敵人或極短間隔），手工設計的前 20 波能確保「wave1-3 易懂」的教學曲線精確可控，程序化公式只需負責「延伸」而非「從零生成」。

7. **無限波效能防護：場上同時存活敵人數設硬上限，超額敵人排入等待佇列**
   - 理由：需求特別強調「因為禁止 Canvas，特別注意 DOM 數量」「第一版不要同時生成大量敵人」；無限波若不設防護，極高波次的出怪數量公式會讓同時存活敵人數無上限成長，導致 DOM 節點暴增與畫面卡頓。
   - 做法：`WaveSystem` 維護一個 `MAX_CONCURRENT_ENEMIES`（建議 40）上限，出怪佇列依 `interval(wave)` 逐一 spawn，但當場上存活敵人數已達上限時，新的 spawn 請求會延後（佇列等待，不取消、不跳過），確保同一時刻的 DOM 敵人節點數有明確天花板，無論波次多高；`count(wave)` 公式（Decision 6）本身也用 `MAX_SPAWN_PER_WAVE` 封頂單波總出怪量，避免出怪佇列本身無限增長。此上限是純技術防護，不改變難度設計意圖（敵人只是「排隊等進場」，整體壓力不變甚至因排隊而更集中）。
   - 替代方案：不設上限，依賴瀏覽器效能自然劣化——放棄，直接違反需求的效能守則，且高波次的失敗應該來自「玩家防禦力跟不上」而非「瀏覽器先卡死」。

8. **分數/Coin 校準：新增 `gameKey: 'towerDefense'`，score＝擊殺獎勵累積＋波次通過獎勵，無限波下防呆上限需大幅放寬**
   - 理由：TD 沒有「時間」或「消除數」這類既有可比照的計分基礎，需要獨立設計；且需比照全專案「一場優秀表現 ≈ 100 coin」的既定校準目標（見 `feedback`/`project` 記憶：coin 每日上限沿用 100000 的全站慣例）。無限波模式下分數**沒有理論上限**（玩家理論上可以一直撐下去），`maxReasonableScore()` 若沿用「破關即上限」的估算方式會誤判合法的長局為異常，需要重新設計校準基準。
   - 做法（設計階段估算值，上線後應實測校準）：`score` 隨遊戲進行即時累加＝Σ（擊殺獎勵 Gold 數 × 2）＋ 每過一波 `100 × wave`；以「撐到 wave 20～25」（與原始 20 波規格相近的遊玩長度）作為「一場優秀表現」的校準基準點，粗估落在 15000～25000 區間；`coinRate: 0.005`（撐到 wave 20～25 約 75～125 coin，貼近既有「≈100 coin」目標；撐得更久的玩家分數雖然更高，但受 `coinCapPerRun` 封頂，不會無限換取更多 coin）；`coinCapPerRun: 150`（維持不變，避免超長局帶來 coin 通膨）；`coinDailyCap: 100000`（沿用全遊戲統一慣例）；`maxReasonableScore(): 300000`（大幅高於原本「破關上限」式的估算，理由：這是防呆用的異常值防線，不是「好成績」的天花板——無限波下一名頂尖玩家單局撐到 wave 60～80 都屬合理，須確保這類**合法**長局不會被防呆機制誤擋，同時仍能攔下明顯竄改的離譜數字）。
   - 替代方案：score 只採用「抵達的最高 Wave」單一數值——放棄，無法反映玩家在單一 wave 內的擊殺效率與經濟操作，且與其他遊戲「累積分數」的計分語感不一致。
   - 替代方案：`maxReasonableScore()` 維持原本 40000 的估算——放棄，無限波下這會把「撐到 wave 40+」的合法優秀表現直接判定為異常分數並擋下紀錄，與「讓玩家有動機挑戰更高波次」的設計目標矛盾。

## Risks / Trade-offs

- [風險] 單檔 engine 承載 6 個子系統（Enemy/Tower/Projectile/Wave/Economy/Upgrade），檔案量級預估會是全專案最大的 engine 檔之一（600～900 行）——因應：用具名 class + 清楚的區塊註解分隔，Phase 1～8 逐步疊加而非一次寫完，每個 Phase 都先驗證可玩再繼續（見 Context 第 5 節 MVP 順序）。
- [風險] 「發射當下鎖定目標」簡化子彈判定，若目標在子彈飛行動畫播放中被其他塔擊殺，畫面上會出現子彈飛向已消失敵人座標的視覺瑕疵——因應：子彈動畫改為飛向「命中當下記錄的固定座標」而非持續追蹤目標的即時位置，视觉上仍合理（敵人死亡後留在原地淡出，子彈打中該淡出位置不違和）。
- [風險] Wave 強化的 5 個全域倍率疊加，理論上玩家連續選同一項可能讓數值失衡（例如連續 5 次 Gold+20% 造成經濟爆炸）——因應：Phase 9 數值平衡階段需實測疊加上限是否需要收斂（例如同類型強化選項出現機率隨已選次數遞減），本次設計不預先假設精確平衡，留待實測。
- [風險] Boss HP／`WAVE_TABLE`／`WaveGenerator` 公式數值皆為設計階段粗估，實際遊玩時長與難度曲線需要多輪調優才能達到需求「不要讓玩家在前幾波就死亡，也不要一路無腦通關」的目標——因應：Phase 9 專門處理數值平衡，架構本身（非線性難度來源：數量/速度/組成/節奏/Boss）已預留足夠調整空間，不需要架構層面的重構。
- [風險] score 計分公式（擊殺+過波）與 coinRate 估算尚未經實測校準——因應：比照 ARKANOID Decision 6 的慣例，上線後依實測分數分佈調整常數，不影響架構本身。
- [風險] 無限波的 `WaveGenerator` 公式（Decision 6）在第 21 波與第 20 波交界處，若參數沒接好容易出現難度斷崖式跳升或驟降——因應：公式刻意沿用與 `WAVE_TABLE` 相同的 HP 成長曲線與數量/間隔量級，Phase 8 實作時需專門測試 wave19→20→21→22 的難度連續性。
- [風險] `MAX_CONCURRENT_ENEMIES`／`MAX_SPAWN_PER_WAVE`（Decision 7）數值若設太低，高波次會出現敵人在佇列中長時間等待、玩家看不到對應的視覺壓力（明明很難卻感覺不出來）；設太高則失去效能防護意義——因應：Phase 9 依實測 DOM 效能與手感一併調整，不是一次定案的數字。
- [風險] `maxReasonableScore()` 從 40000 大幅放寬到 300000（Decision 8）會降低防呆機制攔截異常竄改分數的靈敏度——因應：這是無限波模式的必要取捨（合法長局分數本就可能很高），若上線後發現異常分數大量通過，應優先在 server 端補「分數成長速率是否合理」這類更精細的檢查，而非重新調低固定上限誤傷正常玩家。

## Migration Plan

- 全新功能，無既有資料需要遷移，`gameKey: 'towerDefense'` 為獨立鍵值，不影響既有 24 款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有先例的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/towerDefenseEngine.ts` 純邏輯核心（尚未被頁面引用，可獨立單元測試 Enemy/Tower/Wave/Upgrade 規則），依 Phase 1～8 逐步疊加功能
  6. 遊戲頁面 `app/pages/game/tower-defense.vue`（此步驟起才有實際資料寫入行為），依 Phase 1～10 逐步串接 engine 功能並驗證可玩性
  7. `game-hall.vue` + `GameMachineCard.vue`（透過 `gameSprites.ts`）+ `GameHistoryDialog.vue`（此步驟起使用者才看得到入口）

## Open Questions

- Wave 強化選項是否需要隨已選次數調整出現機率（避免單一 Build 極端疊加）——留待 Phase 9 數值平衡階段依實測決定，不影響本次架構。
- Boss 是否需要除「HP<30% 加速」以外的其他特殊機制（例如週期性治療、召喚小怪）——需求本身未要求，本次 Non-Goal，留待後續變更視實測手感決定是否加入。
- 第 1～20 波完整出怪表（各波確切數量/間隔）留待 Phase 6/8 實作階段依 Decision 6 的設計草案展開為具體常數，本次僅確定分段難度曲線與 Boss 波次。
- `WaveGenerator`（第 21 波起）的公式參數（`count`/`interval`/組成比例的具體係數、`MAX_SPAWN_PER_WAVE`）與 `MAX_CONCURRENT_ENEMIES` 上限，皆為 Decision 6／7 的設計階段估算值，留待 Phase 8 實作與 Phase 9 數值平衡階段依實測手感與效能調整。
- Boss HP 等比成長公式 `800 × 1.6^(bossIndex-1)` 的成長率 1.6 是否合適（太快會讓中高波次 Boss 難以擊殺、太慢則失去週期性壓力）——留待實測校準，不影響架構本身。
