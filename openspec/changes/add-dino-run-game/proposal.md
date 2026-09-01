## Why

使用者的開發計畫要求「第一階段：只分析目前專案，不要直接修改 Code」，比較 RUNNER 與 DINO RUN，並在完成分析輸出後停止等待確認。本提案就是這個分析階段的產出。

分析結果必須誠實面對一個關鍵發現：`app/pages/game/runner.vue`（共 948 行）**已經完整實作**了 DINO RUN 需求文件列為「第一階段 MVP」的全部項目——Auto Run、Player、Jump、Gravity、Ground、Ground Obstacle、Obstacle Spawn、Auto Scroll、Collision、Score、High Score、Difficulty Increase——而且連「第二階段」清單裡的 **Flying Obstacle**（`type ObstacleType = 'ground' | 'air'`，`spawnObstacle()` 用 `isAir` 隨機決定）與 **Duck/Crouch**（`type PlayerState = 'standing' | 'jumping' | 'ducking'`，`duckHeld` 私有欄位追蹤下蹲鍵是否按住）都已經做完。RUNNER 現有規則文字（`RUNNER_RULE.description`）原文就寫著：「地面障礙需跳躍閃避，空中障礙需下蹲閃避；無論跳多高都無法閃避空中障礙，只有下蹲才行」——這與 DINO RUN 需求文件描述的核心玩法幾乎逐字相同。

這代表如果照單全收把 DINO RUN 當一款全新獨立遊戲做，會產生一個和 RUNNER 玩法機制幾乎一模一樣、只是美術主題換成恐龍的重複遊戲。這正是需求文件裡「不要直接複製 Chrome Dino 的角色/Logo/素材」精神下更廣義的風險——不是版權問題，而是**玩法本身沒有差異化，等於做兩份維護成本、給玩家的內容卻是同一個遊戲換皮**。

因此本次不直接進入開工，而是依需求「第一階段」規定完成分析輸出（見 design.md `## Context`），並提出兩個可行方向讓使用者拍板（見 design.md `## Decisions` 與 `## Open Questions`）。

**使用者已拍板：採用方案 B——不新增 DINO RUN 這款獨立遊戲。** 下方「若採方案 A」的內容予以保留作為分析紀錄，但**不會執行**；Double Jump／Day-Night／Challenge Mode 這些差異化玩法構想，將改以獨立的 RUNNER 擴充提案（例如 `update-runner-game-endless-extras`，待另行建立）處理，繼續使用 RUNNER 既有的 `gameKey`／程式碼／紀錄，不產生新的遊戲頁面或新的 `gameKey`。本批 9 款遊戲的最終數量因此為 8 款（2048／Flappy／Frogger／Connect4／Whack-a-mole／Lights Out／Tower Stack／Arkanoid），DINO RUN 名額不遞補。

## What Changes（方案 A 的原始暫定規劃，僅供紀錄，**不執行**——已改採方案 B，見上方最終決議）

以下內容為原本方案 A 的分析紀錄，**本次不落地、不執行**：

- 新增遊戲頁面 `app/pages/game/dino-run.vue`（**DINO RUN**）：
  - 玩法核心（Auto Run／Jump／Gravity／Ground Obstacle／Flying Obstacle／Duck／Auto Scroll／Collision／Score／Difficulty Increase）直接比照 RUNNER 現有邏輯設計（物理參數、障礙生成節奏、`LEVEL_SCORE_THRESHOLDS` 式難度分段），不重新發明一套規則。
  - 差異化玩法：新增 RUNNER 目前沒有的 **Double Jump**（空中再按一次跳躍鍵可再跳一次，僅限一次）；美術主題換為原創 Pixel Dino 角色與原創障礙物造型（仙人掌/翼手龍剪影等，皆原創繪製，不使用 Chrome Dino 或任何受版權保護的角色/Logo/素材）。
  - 主題色採 `#6a994e`（橄欖綠），與 RUNNER 的 `#ffd400`（黃）及既有其餘 16 款遊戲配色皆不撞色。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，規則文字需明確寫出「本作與 RUNNER 的差異僅在 Double Jump 與美術主題」，避免玩家困惑。
- 新增純邏輯核心 `app/utils/dinoRunEngine.ts`（不依賴 Vue）：以 RUNNER 現有的 `RunnerEngine`（頁面內 class）邏輯為藍本重新實作一份獨立 engine（而非抽出共用 engine，見 design.md Decision 1 的取捨），額外處理 Double Jump 的跳躍次數計數。
- 新增 server 端服務檔 `server/services/game/retro/dinoRun.ts`，繼承既有 `RETRO_GAME_BASE`，比照 RUNNER（`coinRate: 0.5`／`coinCapPerRun: 300`／`maxReasonableScore(): 1700`）估算校準，並在 `server/services/storage.ts` 新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/dinoRun/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'dinoRun'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（`key: 'dinoRun'`，icon 🦕，glow `#6a994e`）。
- `app/pages/game-hall.vue` 新增一筆 `id: 25`、`name: 'DINO RUN'`、`status: 'open'`、`path: '/game/dino-run'` 的卡片。

**本次 OpenSpec 變更不包含以上任何程式碼落地**，且因方案 B 已定案，以下內容確定不會排入 tasks.md 實作。

## Capabilities

### Modified Capabilities

- 無。方案 B 定案後，本提案不擴充 `game-history` 能力，不新增 `dinoRun` 這個 `gameKey`。

## Impact

- **本次不修改 `app/pages/game/runner.vue`，也不修改任何既有程式碼檔案**——本變更僅有 `openspec/changes/add-dino-run-game/` 底下的分析文件，不影響既有 16 款遊戲的程式碼與行為，也不會產生 `dino-run.vue`。
- **最終決議：方案 B**（見 design.md Decision 5／Open Questions）——不新增 DINO RUN 這款獨立遊戲。Double Jump／Day-Night／Challenge Mode 改由另一個獨立的 RUNNER 擴充提案處理，本文件僅作為分析紀錄保留，不會有後續實作階段。
- 本批遊戲清單最終為 8 款（不含 DINO RUN），不涉及資料庫。
