## Why

現有 Match3 RUSH／CLASSIC 只做最基本的三消（任意方向 3 連消以上），使用者提供了一份完整的三消規則文件，要求補上業界標準的特殊方塊機制（4 連消→Line Bomb、5 連消→Color Bomb、L/T 型連消→Bomb）與全新的 Combo 計分模型（每輪連鎖 Combo 線性遞增，分數＝清除格數 × 每格基礎分 × Combo），讓遊戲深度與典型三消遊戲對齊。

## What Changes

- `app/utils/match3Engine.ts` 核心改寫：
  - 資料模型新增平行的 `special: Match3SpecialKind[][]` 陣列（顏色維持原本的 `grid: number[][]` 不動，降低對既有邏輯的破壞性）。
  - 消除偵測從扁平清單改為帶形狀資訊的 `findMatchGroups()`，區分 3/4/5+ 連消與 L/T 型，且特殊方塊格永遠不參與被動連線偵測。
  - 引爆／連鎖清除演算法：worklist 處理特殊方塊被消除／被爆炸波及／被連鎖觸發，Line Bomb／Bomb 優先於 Color Bomb 處理以確保目標色判定確定性。
  - 玩家直接交換特殊方塊必定觸發（不復位），雙特殊方塊互換時兩者各自獨立引爆，不做組合技。
  - Combo 計分模型取代原本的半階成長公式：Combo 從 1 線性遞增，分數＝清除格數 × 4 × min(Combo, 6)，並加上單輪／整條連鎖的分數上限防止複合成長暴衝。
  - 無解偵測與洗牌調整為特殊方塊感知：只看顏色連消是否存在，洗牌時保留盤面上既有的特殊方塊。
- `app/pages/game/match3-rush.vue`、`match3-classic.vue`：棋盤格渲染特殊方塊圖示（💣／🌈／↔️／↕️）、Combo 彈出文字改為隨 Combo 數值縮放字體、RULE dialog 的玩法說明與計分公式同步更新。

## Capabilities

### Modified Capabilities

- `game-history`：Match3 RUSH／CLASSIC 的計分公式與消除規則改變，影響寫入遊戲紀錄的 `score` 數值量級；不影響紀錄的資料結構或 A/B 雙模式切換邏輯。

## Impact

- 修改檔案：`app/utils/match3Engine.ts`、`app/pages/game/match3-rush.vue`、`app/pages/game/match3-classic.vue`
- 不涉及 server 端變更（`coinRate`／`maxReasonableScore` 等常數暫不調整，待實測分數分佈後再校準，見 design.md）
- 不影響 SNAKE／RACING／TETRIMINOS 三款遊戲
