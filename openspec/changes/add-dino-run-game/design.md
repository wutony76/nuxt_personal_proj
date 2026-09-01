## Context

> **關鍵發現（本次分析最重要的結論，請優先閱讀）**
>
> 已實際讀過 `app/pages/game/runner.vue`（共 948 行）確認：**RUNNER 目前已經完整實作了 DINO RUN 需求文件列為「MVP／第一階段」的全部項目，以及「第二階段」清單裡的 Flying Obstacle 與 Duck/Crouch**。具體證據：
> - `type PlayerState = 'standing' | 'jumping' | 'ducking'`（第 7 行）——已有下蹲狀態。
> - `type ObstacleType = 'ground' | 'air'`（第 8 行）——已有地面／空中兩種障礙，`spawnObstacle()` 用 `isAir` 隨機決定生成哪種。
> - `duckHeld` 私有欄位（第 66 行）追蹤下蹲鍵是否按住；`playerState` 依 `duckHeld` 切換 `ducking`/`standing`（第 178 行）。
> - `LEVEL_SCORE_THRESHOLDS = [0, 50, 120, 230, 400]`（第 43 行）——依分數分段提高捲動速度與障礙密度，對應需求的 Difficulty Increase。
> - `RUNNER_RULE.description` 原文（第 244～246 行）：「地面障礙需跳躍（↑/W/空白鍵）閃避，空中障礙需下蹲（↓/S）閃避；撞到任一障礙物即結束。**無論跳多高都無法閃避空中障礙，只有下蹲才行；下蹲也無法閃避地面障礙，只有跳躍才行。**」——這段文字與 DINO RUN 需求文件描述的核心玩法幾乎逐字相同。
> - waiting/ready/countdown/result 完整流程、`rateDialogOpen`/`ruleDialogOpen`、`score`（存活距離持續累加，無上限）、`level`（依分數分段）皆已存在。
>
> **換句話說，若照單全收把 DINO RUN 當一款全新獨立遊戲做，會產生一個和 RUNNER 玩法機制幾乎一模一樣、只是美術主題換成恐龍的重複遊戲。** 這不是版權問題（原始需求已提醒不可複製 Chrome Dino 素材，本文件亦遵守），而是更根本的「換皮重複遊戲」風險：兩個頁面會有兩份幾乎相同的物理/碰撞/難度曲線程式碼，日後任何規則調整（例如難度曲線微調）都要改兩處，卻只換來玩家眼中「同一個遊戲的兩種皮膚」。在本批 9 款新遊戲提案中，這是**重疊度最高、最需要使用者在動工前先拍板方向**的一款。

依需求文件「第一階段」規定，以下逐項回答要求的 5 項輸出：

**1. RUNNER 與 DINO RUN 的差異**

目前差異幾乎為零。逐項比對：

| 項目 | RUNNER（既有） | DINO RUN（需求文件） | 差異 |
|---|---|---|---|
| Auto Run | 已有，`tickTimer` 驅動自動向前 | 要求 | 無差異 |
| Player / Jump / Gravity | 已有，`jumpOffset` 物理模擬 | 要求 | 無差異 |
| Ground / Ground Obstacle | 已有，`ObstacleType = 'ground'` | 要求 | 無差異 |
| Obstacle Spawn / Auto Scroll | 已有，`spawnObstacle()` | 要求 | 無差異 |
| Collision | 已有 | 要求 | 無差異 |
| Score / High Score | 已有，`score` 累加＋`useGameHistory` | 要求 | 無差異 |
| Difficulty Increase | 已有，`LEVEL_SCORE_THRESHOLDS` | 要求 | 無差異 |
| Flying Obstacle（需求列為**第二階段**） | **已有**，`ObstacleType = 'air'` | 第二階段項目 | RUNNER 已超前完成 |
| Duck/Crouch（需求列為**第二階段**） | **已有**，`playerState: 'ducking'` | 第二階段項目 | RUNNER 已超前完成 |
| Double Jump（需求列為第二階段） | **沒有**，RUNNER 只允許單次跳躍 | 第二階段項目 | 唯一 RUNNER 缺少的第二階段項目之一 |
| Day/Night（需求列為第二階段） | **沒有** | 第二階段項目 | RUNNER 沒有的視覺層項目 |
| Challenge Mode（需求列為第二階段） | **沒有** | 第二階段項目 | RUNNER 沒有的模式層項目 |
| 美術主題 | 像素跑者（黃色主題 `#ffd400`） | 需求要求「原創 Pixel Runner 角色與障礙物」，主題為恐龍 | 唯一明確的差異點 |

結論：**唯一站得住腳的差異只有美術主題／配色，以及 RUNNER 還沒做的 Double Jump / Day-Night / Challenge Mode 這三個第二階段項目**。若不刻意加入至少一項差異化玩法，DINO RUN 會是一個純換皮遊戲。

**2. 可以重用哪些模組**

幾乎全部核心玩法邏輯都可比照重用（不是程式碼層級的 import 共用，因為 RUNNER 的 engine 是頁面內私有 class，未抽成獨立 `app/utils/xxxEngine.ts`；此處指「設計/邏輯可原樣複製參考，不需要重新設計」）：
- Jump / Gravity 物理參數與位移計算方式
- Obstacle 資料結構（`type ObstacleType`／`Obstacle` shape）與 `spawnObstacle()` 的隨機生成邏輯（含地面/空中比例）
- Auto Scroll 的捲動速度與 tick 節奏
- Collision 判定邏輯
- Score／Level 難度曲線設計（`LEVEL_SCORE_THRESHOLDS` 式分段）
- waiting/ready/countdown/playing/pause/gameover 的狀態機骨架
- 共用外層架構：`useGameHistory`、`GameRateDialog`/`GameRuleDialog`、`server/services/game/retro/base.ts`（`RETRO_GAME_BASE`）、`app/services/api.ts`／`GameHistoryDialog.vue`／`gameSprites.ts`／`game-hall.vue` 的既有擴充點（見下方「建議檔案結構」）

**3. 哪些需要獨立**

- 美術主題／角色造型／障礙物造型（原創 Pixel Dino 與原創障礙物，不可用 Chrome Dino 素材）
- 配色（`#6a994e` 橄欖綠，與 RUNNER 的 `#ffd400` 明顯區隔）
- 可能的差異化玩法：RUNNER 目前沒有的第二階段項目——Double Jump／Day-Night／Challenge Mode（三選一或組合，見 Decision 2）
- 獨立的 `gameKey`（`'dinoRun'`）、獨立的 server 服務檔與 API 路由（即使邏輯雷同，既有架構慣例是「每款遊戲一個服務檔」，不共用同一份紀錄）

**4. 建議檔案結構（若方案 A 定案才會實際建立，見 Decision 1）**

```
app/pages/game/dino-run.vue           # 頁面 + engine class（比照 RUNNER 頁面內 class 的既有模式）
app/utils/dinoRunEngine.ts            # 若決定抽出（見 Decision 1 的取捨），否則邏輯留在頁面內
server/services/game/retro/dinoRun.ts # 繼承 RETRO_GAME_BASE
server/api/games/retro/dinoRun/history.get.ts
server/api/games/retro/dinoRun/history.post.ts
server/api/games/retro/dinoRun/history.delete.ts
```
擴充既有檔案：`app/services/api.ts`（`RetroGameKey`）、`app/composables/useGameHistory.ts`（`GAME_KEYS`／`_handlers.gameApi()`）、`app/components/GameHistoryDialog.vue`（篩選 tab）、`app/config/gameSprites.ts`（`key: 'dinoRun'`）、`app/pages/game-hall.vue`（`id: 25`）、`server/services/storage.ts`（註冊）。

**5. MVP 實作順序（若方案 A 定案）**

1. Server 端服務層＋`storage.ts` 註冊（無風險，尚未被路由引用）
2. Server 端 API 路由（無風險，尚未被前端呼叫）
3. Client `api.ts` 擴充
4. `useGameHistory.ts` 擴充
5. 遊戲核心邏輯（Player／Jump／Gravity／Ground／Ground Obstacle／Auto Scroll／Collision——比照 RUNNER 邏輯）
6. Score／High Score／Difficulty Increase（比照 RUNNER 的 `LEVEL_SCORE_THRESHOLDS` 分段設計）
7. Flying Obstacle／Duck-Crouch（比照 RUNNER 已驗證過的實作方式）
8. 差異化玩法（Double Jump，若 Decision 2 定案採用）
9. Pixel UI／Keyboard／Touch／Pause／Restart
10. `game-hall.vue` 入口＋`GameHistoryDialog.vue`／`gameSprites.ts` 擴充（此步驟起使用者才看得到入口）

以上第 5～9 步「照抄 RUNNER 已驗證過的邏輯」正是本文件要提醒的風險所在——如果只是照抄而不做步驟 8 的差異化，做出來的就是換皮遊戲。

## Goals / Non-Goals

**Goals（本次 OpenSpec 變更，分析階段）：**
- 誠實比較 RUNNER 與 DINO RUN 的重疊程度，完成需求文件要求的 5 項第一階段分析輸出。
- 提出至少兩個可行方案（是否新增此遊戲、如何差異化），交由使用者拍板，不擅自決定方向。
- 不修改任何既有程式碼，尤其不碰 `app/pages/game/runner.vue`。

**Non-Goals（本次不做）：**
- 不在本次變更中撰寫或修改任何 `app/`／`server`／`shared` 底下的程式碼。
- 不在使用者確認方案前先動手實作 tasks.md 列出的任何一項任務。
- 不評估 Power Up／Challenge Mode 以外的其他第二階段項目細節（留待方案定案後的下一輪 design 補完）。

## Decisions

1. **是否抽出共用 Runner Engine——本次傾向「先不抽」，維持 RUNNER 與 DINO RUN 各自獨立的 engine（若方案 A 定案）**
   - 理由：現有架構裡沒有任何一款遊戲的 engine 被兩個頁面共用；RUNNER 的 engine 是頁面內私有 class，不是抽出的 `app/utils/runnerEngine.ts`。若為了 DINO RUN 現在才把 RUNNER 的 engine 抽出來共用，屬於「修改無關遊戲程式碼」（會動到 `runner.vue`），違反本次硬性限制與專案規範「不修改無關遊戲程式碼」。
   - 做法：DINO RUN 若定案實作，`app/utils/dinoRunEngine.ts` 會是一份參考 RUNNER 設計「重新實作」的獨立邏輯（物理參數、障礙生成節奏可以數值上抄一樣的，但程式碼是獨立檔案），額外處理 Double Jump 計數。
   - 替代方案：把 RUNNER 的 engine 抽成 `app/utils/runnerEngine.ts` 共用給兩款遊戲——保留為長期選項，但需要另外一個「重構 RUNNER」的獨立變更（會修改 `runner.vue`），不屬於本次範圍，列入 Open Questions。

2. **差異化玩法選 Double Jump（若方案 A 定案），不選 Day/Night 或 Challenge Mode**
   - 理由：Double Jump 是機制層面的差異（改變閃避策略、允許連續跳躍應對連續地面障礙），比 Day/Night（純視覺層，不影響玩法）更能撐起「這是不同遊戲」的體感；Challenge Mode 涉及額外的模式設計與規則（例如限時/固定關卡），複雜度較高，適合留到 DINO RUN 若站穩腳步後的下一次擴充。
   - 判定邏輯（暫定，待實作階段細化）：`jumpsRemaining` 計數，起跳時消耗一次；著地（`playerState` 回到 `'standing'`）時重置為 2；下蹲狀態不可觸發二段跳（避免與 Duck 判定衝突）。
   - 替代方案：Day/Night 或 Challenge Mode 作為差異化——保留為後續擴充選項，不在本次定案。

3. **美術主題差異化：橄欖綠配色 + 原創恐龍/沙漠障礙物剪影，不使用外部圖片**
   - 理由：專案規範「不使用外部圖片、不引入不必要 dependency」，且需求明確要求不可複製 Chrome Dino 素材；沿用專案既有慣例，用 CSS/DOM pixel-art 風格繪製（比照 RUNNER 本身也是純 CSS 繪製角色）。
   - 做法：主題色 `#6a994e`（橄欖綠），與既有 16 款遊戲配色（`#22ff22` `#67e8f9` `#c4b5fd` `#ff8a2b` `#ff2ea6` `#ffd400`〔RUNNER〕 `#4d7fff` `#39d98a` `#ffd83b` `#ff3b3b` `#2ecc71` `#ffb627` `#1de9b6` `#9d4edd` `#3a86ff`）均不相同，且與 RUNNER 的黃色明顯區隔。

4. **若方案 A 定案，計分模型直接沿用 RUNNER 現有的「存活距離持續累加、理論無上限」設計，coin 校準比照 RUNNER 初始值**
   - 理由：既然玩法核心相同，計分哲學沒有理由重新發明；比照 RUNNER 現有 `server/services/game/retro/runner.ts` 的 `coinRate: 0.5`／`coinCapPerRun: 300`／`coinDailyCap: 100000`／`maxReasonableScore(): 1700`，DINO RUN 若加入 Double Jump 讓玩家能存活更久，分數上限實務上會略高於 RUNNER，`maxReasonableScore()` 初始估算可設 `1900`（略寬於 RUNNER 的 1700，抓 Double Jump 帶來的存活時間提升），上線後依實測校準。
   - `coinRate`／`coinCapPerRun` 初始沿用 RUNNER 同值（`0.5`／`300`），因為計分公式相同（皆為距離持續累加），不需要重新估算比例。

5. **是否新增 DINO RUN 這款遊戲——使用者已拍板選擇方案 B**
   - **方案 A：新增 DINO RUN，但強制加入差異化玩法**（未採用）——換皮＋加入 RUNNER 目前沒有的 Double Jump（見 Decision 2），維持獨立頁面／獨立 `gameKey`／獨立 engine（見 Decision 1）。優點：遊戲數量如期擴充到 25 款，符合原始批次規劃；缺點：仍然要維護兩份高度相似的物理/碰撞程式碼，長期有兩處要同步修的風險（例如日後想調整跳躍手感，需要記得改兩個檔案）。
   - **方案 B：不新增 DINO RUN，改把 Double Jump／Day-Night／Challenge Mode 等第二階段項目直接併入 RUNNER 的下一版擴充**（**已拍板採用**）——以獨立的 `update-runner-game` 類提案處理，RUNNER 保留同一個 `gameKey`／同一份紀錄／同一份程式碼，只是功能變豐富。優點：徹底避免重複维護兩份相似遊戲，玩家能在同一款遊戲裡獲得更豐富的內容；代價：本批遊戲清單最終為 8 款，DINO RUN 名額不遞補。
   - **結論：本提案（`add-dino-run-game`）到此為止不再往下推進，不會產生 `dino-run.vue` 或任何新程式碼；Double Jump／Day-Night／Challenge Mode 待另一個獨立的 RUNNER 擴充提案處理，屆時另開新的 design.md 規劃。**

## Risks / Trade-offs

- **[首要風險] 與 RUNNER 重複度過高**：即使採方案 A 加入 Double Jump，核心跑酷/跳躍/下蹲/難度曲線機制仍與 RUNNER 幾乎相同，玩家可能感覺「這根本是同一款遊戲」，對遊戲中心的內容多樣性貢獻有限——因應：Decision 5 已誠實攤開兩個方案，本文件不淡化這個風險，交由使用者決定是否值得為了美術主題＋一個機制差異新增一整款遊戲。
- **[風險] 若採方案 A 但不落實 Double Jump（只做換皮）**：會做出一個和需求文件「不要換皮」精神直接矛盾的成果——因應：tasks.md 待方案確認後才會排入任務，若使用者選方案 A，Double Jump 需列為必要項目而非可選項目。
- **[風險] 獨立 engine 造成程式碼重複（Decision 1 的取捨）**：`dinoRunEngine.ts` 與 RUNNER 頁面內 engine 邏輯高度相似，日後若 RUNNER 調整物理參數，DINO RUN 不會自動跟著變、需要人工同步——因應：已在 Decision 1 記錄為已知取捨，抽共用 engine 的方案留待未來若使用者認為值得才進行的獨立重構變更。
- **[風險] `maxReasonableScore()` 初始估算（1900）缺乏實測依據**：因為 Double Jump 尚未實作，無法精確評估存活時間提升幅度——因應：比照專案既有慣例，上線後依實測數據校準，不影響架構。

## Migration Plan

- 全新功能，若方案 A 定案，無既有資料需要遷移，獨立 `gameKey`（`'dinoRun'`），不影響既有 16 款遊戲（含 RUNNER）的紀錄與 coin 上限。
- 部署順序（比照 battleship 等既有變更的分步策略，每一步皆可獨立回滾）：
  1. Server 端服務層與 `storage.ts` 註冊
  2. Server 端 API 路由
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. `app/utils/dinoRunEngine.ts`（或頁面內 class，視最終決定）
  6. 遊戲頁面 `app/pages/game/dino-run.vue`
  7. `game-hall.vue` + `gameSprites.ts` + `GameHistoryDialog.vue`（此步驟起使用者才看得到入口）
- 若方案 B 定案，本 Migration Plan 作廢，改由 RUNNER 的下一版擴充提案另訂遷移步驟（不涉及新 `gameKey`）。

## Open Questions

- ~~本次分析階段最重要的待確認事項：方案 A 或方案 B？~~ **已拍板：方案 B**（見 Decision 5）——不新增 DINO RUN，Double Jump／Day-Night／Challenge Mode 併入 RUNNER 下一版擴充，本批遊戲清單最終為 8 款，DINO RUN 名額不遞補。
- 後續待辦：Double Jump／Day-Night／Challenge Mode 三項是否一次做完還是分批做、RUNNER 擴充提案何時建立，留待該提案自己的 design.md 規劃（尚待使用者指示是否現在就建立）。
