## Why

遊戲中心目前的 20+ 款遊戲皆為動作／解謎／棋牌類型，**沒有塔防（Tower Defense）玩法**。使用者明確要求新增一款 TD 塔防，並提出完整且明確的設計規格：3 種塔（弓箭／炮／冰）、4 種敵人（普通／快速／Tank／Boss）、塔升級（每塔 3 級）、Wave 強化選擇系統、單一地圖（CSS Grid）、**絕對禁止 Canvas/WebGL，全 DOM + CSS 實作**，並特別強調「好玩優先於美術」與「玩家死亡後要有再玩一次的動機」。波次系統原始規格為固定 20 波，使用者後續明確要求改為**無限波（Endless）模式**：不設破關終點，第 21 波起難度持續遞增，讓「能撐到第幾波」本身成為重玩動機。使用者已確認採用 OpenSpec 流程，本次先產出提案文件，待核准後才按 Phase 1～10 逐步實作（見 design.md MVP 順序）。

本提案的第一階段分析現有 20+ 款遊戲的實作慣例（重點參考最新的 `app/pages/game/arkanoid.vue` 與 `app/utils/arkanoidEngine.ts`），確認「單一頁面 + 單一 engine 檔，不拆多元件/多檔案」是全專案無例外的既定模式，並將使用者原先設想的「Game/UI/Entities/Map 多資料夾模組化架構」收斂為「在單一 engine 檔內以多個 class 達成邏輯模組化」，避免違反專案「不要過度工程化」的開發原則。完整差異分析與理由列於 design.md `## Context` 與 `## Decisions`。

## What Changes

以下為本提案規劃、**待使用者核准後的未來實作階段**才會發生的變更（本次僅完成文件，不觸碰任何 `app/`／`server`／`shared` 程式碼）：

- 新增遊戲頁面 `app/pages/game/tower-defense.vue`（**TOWER DEFENSE**）：
  - `reactive()` 單一 state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三段式（比照全專案慣例）。
  - CSS Grid 地圖（12 欄 × 8 列），路徑格禁止建塔、草地格可建塔；敵人/塔/子彈皆為 DOM 元素，移動一律用 `transform: translate()`，禁止頻繁修改 `top`/`left`/`width`/`height`。
  - 上方 HUD：Gold／HP／Wave／Enemy Count／Start-Pause；下方塔選單（弓箭塔／炮塔／冰塔）與塔資訊面板（Damage／Attack Speed／Range／Level／Upgrade Cost）。
  - waiting/ready/playing/waveClear/gameOver overlay 流程，比照既有遊戲的 dialog 掛載方式掛 `GameRateDialog`/`GameRuleDialog`。
  - Wave 強化選擇 Modal：每波清完隨機抽 3 個（攻擊力+15%／攻速+15%／Gold收益+20%／射程+15%／冰塔減速+20%）供玩家選 1，效果可疊加。**永遠會出現**（不因波次無限而停止），是玩家持續變強以應付無限難度的核心手段。
  - Restart 完整重置塔／敵人／子彈／Gold／HP／Wave／已選強化，不殘留上一局資料；Pause 期間停用 tick 與所有攻擊/移動判定。
  - **不設「破關」畫面**：唯一的結束方式是 HP 歸零顯示 `GAME OVER`，HUD 全程顯示目前波次與（若有）歷史最高波次，強調「這局能撐到第幾波」。
- 新增純邏輯核心 `app/utils/towerDefenseEngine.ts`（不依賴 Vue，單一檔案，內部以 `EnemySystem`／`TowerSystem`／`ProjectileSystem`／`WaveSystem`／`EconomySystem`／`UpgradeSystem` 等 class 分層，比照 `arkanoidEngine.ts` 的單檔慣例）：
  - 3 種塔（弓箭／炮／冰）各 3 級數值表，炮塔範圍傷害、冰塔減速效果。
  - 4 種敵人（普通／快速／Tank／Boss）基礎數值與隨 wave 的非線性難度曲線（數量／速度／組成／出怪節奏，而非單純堆 HP，見 design.md）。
  - **無限波（Endless）**：第 1～20 波為手工設計的 `WAVE_TABLE`（教學/難度曲線），第 21 波起由 `WaveGenerator` 依公式程序化生成（數量/組成/出怪間隔隨波次持續遞增），Boss 每 10 波固定出現一次（10、20、30…，HP 呈等比成長），無上限、無終點。
  - Tick 驅動（`setInterval`）：敵人沿路徑移動、塔自動索敵攻擊（射程內索敵、冷卻判定）、子彈飛行與命中結算、擊殺獎勵、HP 扣血、Wave 進度與清怪判定；同時對場上同時存活敵人數設上限（見 design.md Decision 9），避免無限波在極高波次時 DOM 節點失控。
- 新增 server 端服務檔 `server/services/game/retro/towerDefense.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/tower-defense/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'towerDefense'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（`icon: '🏰'`、`anim: 'blink'`、`glow: '#6a994e'`，橄欖綠，未與既有 24 款遊戲撞色）。
- `app/pages/game-hall.vue` 新增一筆 `id: 25`、`name: 'TOWER DEFENSE'`、`status: 'open'`、`path: '/game/tower-defense'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `towerDefense` 這個新的 `gameKey`；新增 TD 專屬的分數公式（擊殺獎勵＋通過波次獎勵，非時間或消除型計分，且因無限波不存在理論分數上限，需設計較寬鬆的防呆上限，見 design.md Decision 7），`meta` 欄位可額外記錄 `waveReached`／`towersBuilt`／`bossesDefeated` 供統計呈現，`waveReached` 是無限波模式下最主要的成就指標。

## Impact

**本次（文件撰寫階段）不修改或新增任何 `app/`／`server`／`shared` 程式碼**，只在 `openspec/changes/add-tower-defense-game/` 底下新增本提案文件；**不修改任何既有 24 款遊戲的程式碼與行為**。

未來實作階段（待核准後）預期新增/修改的檔案：

- 新增檔案（client）：`app/pages/game/tower-defense.vue`、`app/utils/towerDefenseEngine.ts`
- 新增檔案（server）：`server/services/game/retro/towerDefense.ts`、對應 3 支 API 路由檔
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new RetroTowerDefenseClass()`）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不修改 `app/pages/game/breakout.vue`、`arkanoid.vue` 或任何其他既有遊戲檔案；TD 為全新玩法類型，與現有動作/解謎/棋牌類遊戲無共用邏輯可重用，不涉及任何既有 engine 的重構評估（不同於 arkanoid 提案需要對 breakout 做重用性分析）
