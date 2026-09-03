## Context

現有 26 款遊戲全數是 DOM + CSS 呈現、`setInterval` 驅動、單一 `*.vue` 頁面 + 可選的獨立 `*Engine.ts` 純邏輯檔的架構（例如 `arkanoidEngine.ts`／`towerDefenseEngine.ts`）。PINBALL 是第一款需要「連續物理模擬＋雙可操作旋轉物件（Flipper）」的遊戲，其餘遊戲的擋板/腳色都是平移而非旋轉＋碰撞反饋，因此本次需要新訂一組物理與碰撞規則，而非重用既有邏輯。

## Goals / Non-Goals

**Goals**：手感（Flipper 反饋、Bumper 反彈）優先於物理真實性；Combo/Fever/Risk-Reward/Upgrade 完整跑通一輪 3 球流程；沿用全站既有頁面/資料/coin 架構模式，維持風格一致。

**Non-Goals**（本次不做，留待後續變更）：永久商店、跨局排行榜、成就系統、多張球桌、Boss、精確剛體物理引擎、外部圖片素材、音效檔案下載。

## Decisions

### Decision 1：固定 Virtual Coordinate + 外層 CSS Scale 置中

物理運算固定在 `PINBALL_WIDTH = 360`／`PINBALL_HEIGHT = 640`（9:16）的虛擬座標系。桌面 DOM 結構為 `.pb-stage-wrap`（用 `ResizeObserver` 量測可用空間）外包一層 `.pb-stage`（固定 360×640px，內部所有物件用 `transform: translate3d(x, y, 0)` 定位），`.pb-stage` 依 `min(availableWidth/360, availableHeight/640)` 算出的 `--pb-scale` 做 `transform: scale(var(--pb-scale))`。好處：物理與碰撞永遠在同一組數字下計算，不因裝置尺寸不同而改變手感（對應開發計畫第二十三節）；此為既有 25 款遊戲沒有的新模式（它們多半是固定寬度＋窄螢幕改版面排列），因為它們的桌面本身不需要 9:16 長條版面，PINBALL 需要，故新增這一層。

### Decision 2：Game Loop 沿用 `setInterval(16ms)`，不採用 `requestAnimationFrame`

開發計畫原文建議 `requestAnimationFrame`，但全站 25 款既有遊戲一致採用 `setInterval(TICK_MS=16)` 驅動 tick（含輸入/物理/碰撞/狀態/渲染同步）。依「如果專案本身已有框架，請沿用現有技術棧」與「優先沿用現有架構」的指示，PINBALL 比照辦理，避免站上出現兩套計時模型；`16ms` 已能提供足夠流暢的物理更新頻率，不影響手感。

### Decision 3：Flipper 是旋轉角度插值 + 撞擊點/角速度決定反饋，不是圖片旋轉

每個 Flipper 為 `{ pivotX, pivotY, length, restAngle, activeAngle, angle, angularVelocity }`。按鍵按下/放開只改變「目標角度」，每個 tick 用固定角速度 `FLIPPER_ANGULAR_SPEED`（約 4 ticks 內完成整段擺動，主觀上「按下立即反應」）把 `angle` 往目標角度插值，藉此推導出真實的瞬時 `angularVelocity`。

碰撞：把 Flipper 視為「圓角膠囊」（`pivot` 到 `tip` 的線段 + 半徑 `FLIPPER_RADIUS`），每 tick 計算球心到該線段的最近點與距離；距離小於 `ball.radius + FLIPPER_RADIUS` 視為碰撞。反饋速度 = 法線反彈分量 + 撞擊點相對 pivot 的切線方向分量（`tangential = angularVelocity × 撞擊點到 pivot 的距離`），使「球撞到正在往上擺動的 Flipper」會被大力打出去、「球停在靜止的 Flipper 上」只會有一般反彈，達成「我把球打回去」的操作感（對應開發計畫第六節）。不做額外 Cooldown：擺動插值本身就限制了連續操作的最高頻率，符合「按下立即反應」原則。

### Decision 4：Combo 倍率與 Fever 是乘法疊加，掉球是唯一的硬重置點

- `combo` 為整數，命中 Bumper／Target／Golden Hole 皆 `combo += 1` 並把 `comboTimer` 重置為 `COMBO_WINDOW_MS`（預設 2500ms，Fever 中乘以 `FEVER_COMBO_WINDOW_MULT = 3`）；`comboTimer` 倒數歸零即 `combo = 0`。
- `comboMultiplier = min(1 + (combo - 1) * COMBO_MULT_STEP, COMBO_MULT_CAP)`（預設 step 0.15、cap 4）。
- 單次命中得分 `finalScore = baseScore * comboMultiplier * (feverActive ? FEVER_SCORE_MULT : 1) * modifiers.scoreMultiplierFor(source)`（`modifiers` 來自 Upgrade，見 Decision 6）。
- 掉球（Ball 進入 Death Zone）：`combo = 0`、`comboTimer = 0`，且不因為「還有其他球」而保留（本作沒有 Multi Ball，單球即代表整條命）。
- Fever 觸發：4 個 Target 全部 `hit = true`。進入 Fever 後：`feverActive = true`、`feverMsLeft = FEVER_DURATION_MS`（10000）、`comboTimer` 視窗放大、Bumper 擊退速度乘 `FEVER_BUMPER_KICK_MULT`；倒數結束：`feverActive = false`、所有 Target `hit = false`（重新開放挑戰）。

### Decision 5：Golden Hole 是「風險加分點」而非第二個 Death Zone

Golden Hole 固定在桌面偏上、偏一側、需要準確的 Flipper 擊球角度才容易命中的位置（不在自然彈跳的高機率路徑上，體現 Risk/Reward）。球心進入 Hole 半徑：`score += 1000 × comboMultiplier`、`combo += 3`、`coinsCollected += 5`（見 Decision 7 的「局內趣味幣」）、觸發強烈視覺（Flash + 短暫 Screen Shake），接着**把球重新從 Launcher 位置以固定初速發射回場上**（不消耗生命、不計入 Death Zone），因為 Golden Hole 的定位是「敢打的人多拿分」的獎勵機關，而不是另一個結束球局的洞。

### Decision 6：Upgrade 數值集中於 `UPGRADE_POOL` 常數表，Engine 用單一 `modifiers` 物件套用

12 個 Upgrade（見開發計畫第十四節）定義為 `{ id, name, description, apply: (modifiers) => void }` 的資料表，儲存於 `pinballEngine.ts` 頂部集中管理，不寫死在 Bumper/Target/Flipper 各自的類別方法裡。Engine 內部維持一個 `modifiers` 物件（例如 `bumperScoreMult`／`targetScoreMult`／`holeScoreMult`／`feverScoreBonusMult`／`comboWindowBonusMs`／`comboMultStepBonus`／`bumperExtraCombo`／`flipperLengthMult`／`flipperKickMult`／`flipperSwingSpeedMult`／`bumperCoinChanceBonus`／`autoFeverAtCombo10`），所有計分/物理公式一律讀這個物件的當前值，Upgrade 選擇只是對它做加法/乘法變更，`reset()` 時整個物件歸回預設值（每次 Run 不留存到下一次 Run，對應開發計畫「Upgrade 不需要做永久保存」）。掉球後若還有剩餘生命，Engine 從 12 個選項中不重複隨機挑 3 個放入 `pendingUpgradeChoices`，供頁面渲染選擇 UI；未選擇前 Engine 暫停 tick。

### Decision 7：兩種「Coin」是獨立概念，UI 上要分開，不能混用同一個數字

- **局內趣味幣（`coinsCollected`）**：只存在於單次 Run，來源為 Bumper 低機率掉落／Golden Hole／Fever 結束獎勵，對應開發計畫第十六節「第一版 Coin 只需要顯示，暫時不要做永久商店」；顯示於 HUD 右上角 `COINS xx`，Restart 後歸零，不呼叫任何 server API。
- **帳號 coin（全站經濟）**：比照其餘 25 款遊戲，遊戲結束時呼叫 `useGameHistory().actions.record('pinball', 'PINBALL', { score, meta })`，未登入寫入 localStorage、已登入呼叫 server 依 `score × coinRate`（本檔 `coinRate` 校準見下）換算入帳，結果的 `+X coin` 訊息顯示在 Game Over 結算畫面（沿用 `breakout.vue` 的 `rewardMessage` 呈現方式），與 HUD 上的「局內趣味幣」是完全不同的數字，不互相加總。
- `server/services/game/retro/pinball.ts` 的 `coinRate`／`coinCapPerRun`／`coinDailyCap`／`maxReasonableScore()` 参考 `arkanoid.ts`（同樣是開放式 Combo 加權計分、量級相近）：`coinRate: 0.01`、`coinCapPerRun: 150`、`coinDailyCap: 100000`、`maxReasonableScore(): 30000`（Fever×3 疊加 Combo 倍率上限後估算的寬鬆防呆值，非精確理論上限）。

### Decision 8：模組化方式比照既有 `*Engine.ts` 慣例，單檔案內分節而非拆成多檔

開發計畫建議的 `Ball/Flipper/Bumper/Target/.../CollisionSystem/...` 分層，全部收斂在 `app/utils/pinballEngine.ts` 一支檔案內，用清楚的區塊註解與獨立函式/私有方法分節（型別定義 → 常數/Upgrade Pool → 物理工具函式 → Flipper → Bumper/Target/Hole 碰撞 → Combo/Fever → Upgrade → `PinballEngine` class 整合），對齊 `arkanoidEngine.ts`（644 行、內部也是 Paddle/Ball/Brick/PowerUp/Combo 都在同一檔）的既有慣例，避免為單一新遊戲builds 出一套獨有的多檔案 ECS 架構。

## Risks / Trade-offs

- Flipper 用「線段最近點」做碰撞偵測，在球速極高時可能發生穿透（tunneling）；以 `MAX_BALL_SPEED` clamp 每 tick 位移量、且 Flipper 半徑略放大於視覺尺寸來降低機率，MVP 階段接受極低機率的偶發穿透，不做 swept-collision（開發計畫明確表示「物理不需要追求 100% 真實，遊戲優先」）。
- `coinRate`/`maxReasonableScore` 為設計階段估算值，上線後應依實測分數分佈校準（比照 arkanoid 現況）。
- Golden Hole 的「風險位置」由桌面固定佈局決定，沒有動態難度；MVP 階段接受，多桌面/動態佈局留待後續版本。

## Migration Plan

不涉及資料遷移；`Storage.retroGames.instances` 為 in-memory 註冊，新增 `pinball` 鍵不影響既有 26 款遊戲的鍵值。

## Open Questions

無（使用者已授權直接依本文件的 Decisions 執行，若實測後方向需調整，後續再提修改）。
