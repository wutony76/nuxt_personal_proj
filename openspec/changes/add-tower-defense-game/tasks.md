> 以下任務為**未來實作階段**（待使用者核准 design.md 的架構決策後）的規劃清單；本次 OpenSpec 提案僅完成文件本身（見第 8 節），不執行第 1～7、9 節的任何項目。實作時嚴格依第 5、6 節標示的 Phase 順序推進，**每個 Phase 完成並確認可玩後才進入下一個 Phase**，不可跳步或合併多個 Phase 一次做完。

## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/towerDefense.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.005`、`coinCapPerRun: 150`、`coinDailyCap: 100000`、`maxReasonableScore(): 300000`——無限波模式下的設計階段估算值，見 design.md Decision 8）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroTowerDefenseClass()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/tower-defense/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有 24 款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'towerDefense'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/towerDefenseEngine.ts`，單一檔案、不依賴 Vue，內部以具名 class 分層，見 design.md Decision 1）

- [ ] 5.1 型別與常數：`Cell`／`Tower`／`Enemy`／`Projectile`／`GameState`，`MAP_LAYOUT`（12×8）、`PATH_WAYPOINTS`、`TOWER_CONFIG`（3 塔 × 3 級，見 design.md Decision 2）、`ENEMY_CONFIG`（4 種基礎值，見 Decision 6）、`MAX_CONCURRENT_ENEMIES`／`MAX_SPAWN_PER_WAVE`／`MIN_SPAWN_INTERVAL`（無限波效能防護常數，見 Decision 7），全部集中管理
- [ ] 5.2 **Phase 1**：`EnemySystem` — 敵人沿 `PATH_WAYPOINTS` 依序移動（`transform: translate()`），先無塔無戰鬥，驗證 DOM 移動手感與 tick 節奏（`setInterval`，建議 `TICK_MS` 80～100ms，deltaTime 累積移動量）
- [ ] 5.3 **Phase 2**：`TowerSystem` 基礎 — `canPlace()`（僅 `grass` 格可建）、`placeTower()`、塔的射程/位置資料結構
- [ ] 5.4 **Phase 3**：`TowerSystem` 自動攻擊（射程內索敵＋冷卻判定）＋ `ProjectileSystem`（發射當下鎖定目標與傷害、固定飛行時間動畫、終點結算，見 design.md Decision 4）
- [ ] 5.5 **Phase 4**：`EconomySystem`（Gold 增減、造塔/升級花費檢查）＋ `WaveSystem` 基礎（Wave 顯示、敵人抵達終點扣 HP、HP 歸零判定 Game Over）
- [ ] 5.6 **Phase 5**：`TowerSystem` 升級 — 3 級數值套用（Damage/Attack Speed/Range/特殊能力，見 Decision 2 數值表），`upgradeTower()` 需檢查 Gold 是否足夠
- [ ] 5.7 **Phase 6**：`ENEMY_CONFIG` 四種敵人差異化（普通/快速/Tank 依 Decision 6 數值），`WAVE_TABLE` 常數依 Decision 6 難度曲線展開為第 1～20 波具體出怪表（wave 1～9、11～19，Boss 波留到 5.9）
- [ ] 5.8 **Phase 7**：`UpgradeSystem` — Wave 強化池（5 選項，見 Decision 5）、每波清完隨機抽 3 個、選擇後套用全域倍率並可疊加
- [ ] 5.9 **Phase 8a**：`WAVE_TABLE` 補上第 10、20 波 Boss（含護衛怪），Boss 特殊行為（HP<30% 加速 20%，見 Decision 6）
- [ ] 5.11 **Phase 8b（無限波）**：`WaveGenerator` — 第 21 波起依 Decision 6 公式程序化生成出怪數量/組成/間隔，`WaveSystem` 改為「第 1～20 波查 `WAVE_TABLE`，第 21 波起呼叫 `WaveGenerator`」；Boss 週期性生成邏輯（`bossIndex = wave / 10`，每 10 波觸發，HP 依 `800 × 1.6^(bossIndex-1)` 等比成長，見 Decision 6）；`WaveSystem` 出怪佇列套用 `MAX_CONCURRENT_ENEMIES`／`MAX_SPAWN_PER_WAVE` 上限（見 Decision 7），確保無限波不會讓場上敵人數/DOM 節點無上限成長；移除任何「第 20 波即結束/通關」的判定，遊戲永遠只靠 HP 歸零結束
- [ ] 5.10 `TowerDefenseEngine` class：整合 5.1～5.9、5.11 各子系統，提供 `tick()`／`reset()`／`getSnapshot()`／`placeTower()`／`upgradeTower()`／`chooseWaveUpgrade()`／`startWave()`／`pause()`／`resume()`

## 6. 遊戲頁面與互動流程（`app/pages/game/tower-defense.vue`，單一檔案，不拆子元件，見 design.md Decision 1）

- [ ] 6.1 `reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照全專案慣例）
- [ ] 6.2 **Phase 1 對應**：地圖渲染（CSS Grid 12×8，路徑格/草地格視覺區分，起點🏁/終點🏰），敵人 DOM token 渲染與移動
- [ ] 6.3 **Phase 2 對應**：塔選單（[🏹 弓箭塔] [💣 炮塔] [❄️ 冰塔]）、點格子建塔（草地格 hover 高亮、路徑格點擊提示不可建）
- [ ] 6.4 **Phase 3 對應**：塔攻擊動畫（子彈 DOM token，`transform` 飛行＋結束自動移除）、炮塔範圍傷害一次性爆炸特效
- [ ] 6.5 **Phase 4 對應**：HUD（Gold／HP／Wave／Enemy Count／Start-Pause）
- [ ] 6.6 **Phase 5 對應**：點擊塔顯示塔資訊面板（Damage／Attack Speed／Range／Level／Upgrade Cost），`[Upgrade]` 按鈕
- [ ] 6.7 **Phase 6 對應**：四種敵人視覺區分（顏色/尺寸/emoji），Tank／快速怪明顯可辨識
- [ ] 6.8 **Phase 7 對應**：Wave 強化選擇 Modal（3 選 1，下一波開始前必須完成選擇）
- [ ] 6.9 **Phase 8 對應**：Boss 視覺（明顯放大/特殊配色）、Boss 波次警示（每 10 波皆會觸發，非僅第 10/20 波）；HUD 的 Wave 顯示改為純數字遞增（不顯示「/20」這類總波數上限），不做任何「破關/通關」畫面
- [ ] 6.10 Game Over／Restart：HP 歸零顯示 `GAME OVER`（顯示本局抵達的最高波次）並寫入紀錄；`[Restart]` 完整重置塔／敵人／子彈／Gold／HP／Wave／已選強化，不殘留上一局資料
- [ ] 6.11 Pause（`[Pause]` 按鈕或 ESC）：暫停期間停用 tick、攻擊與移動判定，Wave 強化倒數（若有）同步暫停
- [ ] 6.12 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#6a994e`（橄欖綠，不與現有 24 款遊戲撞色）
- [ ] 6.13 **Phase 9**：數值平衡與手感調整——依實測結果調整 5.1 常數（塔數值/敵人數值/WAVE_TABLE/WaveGenerator 公式/強化倍率），確保 wave1-3 易懂、wave4-7 需思考、wave8-10 有壓力、wave10 Boss 首次考驗 Build、wave11-15 明確策略、wave16-20 高壓、wave21+ 持續遞增且與 wave20 難度平滑銜接（不斷崖式跳升）
- [ ] 6.14 **Phase 10**：像素風 UI 收尾——黑色描邊、Pixel Font、有限色彩、簡單 CSS 動畫，不引入漸層/玻璃效果/過度圓角

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 25, name: 'TOWER DEFENSE', status: 'open', path: '/game/tower-defense' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'towerDefense'`, `match: (n) => n.includes('TOWER DEFENSE')`, `icon: '🏰'`, `anim: 'blink'`, `glow: '#6a994e'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [x] 8.1 `README.md` / `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身，已於本輪產出）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試 Phase 1～8 各階段：敵人移動、建塔、自動攻擊、Gold/HP/Wave 迴圈、升級、四種敵人、Wave 強化、Boss，皆正常
- [ ] 9.2 實測塔放置限制：路徑格無法建塔，草地格可正常建塔且不重疊
- [ ] 9.3 實測塔自動攻擊：射程內正確索敵、冷卻時間符合設定、升級後數值正確變化
- [ ] 9.4 實測炮塔範圍傷害：命中範圍內多隻敵人同時受傷，特效正確播放並移除
- [ ] 9.5 實測冰塔減速：命中後敵人移動速度正確降低，減速效果依 Lv 正確疊加/更新
- [ ] 9.6 實測 Wave 強化：每波清完正確彈出 3 選 1，選擇後全域倍率正確套用且可疊加
- [ ] 9.7 實測 Boss：wave10、wave20（`WAVE_TABLE`）與 wave30（`WaveGenerator`）皆正確出現 Boss、HP 依等比公式成長、HP<30% 加速機制正確觸發；非 10 的倍數波次確認不出現 Boss
- [ ] 9.8 實測第 1～20 波完整流程：難度曲線符合 design.md 分段預期（不會前幾波就死、不會全程無腦通關）；額外實測撐到 wave 25～30 左右，確認第 21 波起 `WaveGenerator` 難度持續遞增、與 wave20 銜接處無斷崖式跳升或驟降，且遊戲不會在第 20 波後出現任何「破關」畫面
- [ ] 9.9 實測 Game Over／Restart／Pause：HP 歸零正確結束、Restart 完整重置不殘留、Pause 期間不計時不觸發攻擊/移動
- [ ] 9.10 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.11 已登入：確認 server 端紀錄寫入、coin 依 score × coinRate 入帳、單局與每日上限機制正確
- [ ] 9.12 `GameHistoryDialog` 篩選 tab 能正確顯示 `TOWER DEFENSE` 紀錄與統計
- [ ] 9.13 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/tower-defense`
- [ ] 9.14 確認沒有 Console Error，且其餘既有 24 款遊戲行為完全不受影響
- [ ] 9.15 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
- [ ] 9.16 效能檢查：Wave 後期（大量敵人同時在場，如 wave15+ 三十餘隻，以及 wave30+ 的 `WaveGenerator` 輸出）DOM 節點數與畫面流暢度可接受，無明顯掉幀；驗證 `MAX_CONCURRENT_ENEMIES` 上限確實生效（場上存活敵人數不超過上限，超額敵人正確排入等待佇列而非被跳過）
