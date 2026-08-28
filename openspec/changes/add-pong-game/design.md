## Context

- `add-game-history` 已建立 game-hall 小遊戲的完整架構：client 頁面自包含（engine class + ref 鏡像 snapshot）＋ `useGameHistory`（A/B 雙模式：未登入 localStorage／已登入 server API）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）。
- `add-match3-games` 額外確立了「五款遊戲都掛 `GameRateDialog`／`GameRuleDialog`（coin 兌換比＋玩法規則說明，訪客也可查看）」的慣例，以及「難度可隨進度升級」「試玩後再校準常數」兩個做法。
- 現有五款遊戲（snake/racing/tetriminos/match3rush/match3classic）的 `score` 語意都是「單局內的原始遊戲表現值」（蛇身長度、存活距離、清除格數）；PONG 是本次第一款「一場比賽由多個子局組成，且明確要求以『贏了幾局』計分」的遊戲，跟既有慣例的分數語意不同，需要在架構上特別標註，避免未來看紀錄時誤解。
- PONG 傳統上是雙人對戰玩法；本專案既有五款遊戲皆為單人（對抗環境／對抗自己），且沒有「玩家對玩家」的對戰配對基礎設施（`useChat`／`useSocket` 只做廣播聊天室，沒有配對／房間機制），比照既有慣例做**單人對戰 CPU**。

## Goals / Non-Goals

**Goals:**
- 玩家可在開局前選擇本場局數（3／5／10），選定後比賽固定打滿該局數才結束（非「先贏 2 局就提前結束」的 best-of-N 提前終止賽制）。
- 最終寫入 `useGameHistory` 的 `score` 明確定義為「玩家在這場比賽中獲勝的局數」，範圍 `0～N`；單局內的來回比分只是遊戲進行中的暫態 UI 顯示，不是最終分數。
- Server 端、client 資料層、game-hall 入口完全比照既有五款遊戲的慣例逐一擴充，不引入新的架構模式（例如不新增配對系統、不新增資料庫）。

**Non-Goals:**
- 不做玩家對玩家的即時對戰（沒有配對／房間基礎設施，且大幅超出「新增一款小遊戲」的範疇）。
- 不做 CPU 難度隨局數／分數自動升級（不同於 match3 的既有慣例）——PONG 的「分數」範圍只有 0～10，區間太窄，用它驅動難度曲線意義不大；本次維持單一固定難度的 CPU，是否要另外設計「難度隨局數推進」留待 Open Questions。
- 不做排行榜、不做遊戲重播、不引入資料庫（沿用 in-memory）。
- 不做「登入時合併本地與 server 紀錄」（沿用 `add-game-history` 既有的 Non-Goal）。
- 不做後台可調參數介面（`coinRate`／局內目標分數等常數仍寫死在服務檔／頁面常數，比照既有五款遊戲的既有限制與 Follow-up）。

## Decisions

1. **單人對戰固定難度 CPU，而非雙人對戰**
   - 理由：比照現有五款遊戲的既有慣例（單人玩法），且專案沒有玩家配對基礎設施；新增配對／房間系統是完全不同量級的功能，不屬於「新增一款小遊戲」的合理範疇。
   - 做法：CPU 追蹤球目前的 y 座標作為目標位置，但移動速度設有上限（低於玩家可達到的反應速度），且只在球朝向 CPU 那一側移動時才開始追蹤（球飛向對面時 CPU 緩慢回中），讓 CPU 「可被擊敗但不會形同虛設」。

2. **最終 `score` 定義為「玩家獲勝局數」，單局內來回比分只是暫態 UI 狀態，不寫入 `useGameHistory`**
   - 理由：使用者明確要求「依照勝利的局數來計算分數」。若沿用「單局來回比分加總」當作分數，會跟其他遊戲的「原始表現值」語意接近，但沒有意義（例如 5 局制打滿，來回比分總和永遠落在一個跟「贏幾局」不成正比的範圍，無法直觀反映「這場打得好不好」）。
   - 做法：頁面內部維護 `roundsWon`／`roundsLost`（整場戰績）與 `rallyScore`（僅目前這一局的來回比分，局末歸零重算）兩組獨立狀態；`_actions.recordHistory()` 只送出 `roundsWon` 作為 `score`，`rallyScore` 純粹是 UI 顯示、不入庫。

3. **局數選項固定為 3／5／10，打滿全部局數才結束（非 best-of-N 提前終止）**
   - 理由：使用者明確指定選項與規則（「3 局後結束」＝打完 3 局就結束，不是「先贏 2 局即結束」的傳統 best-of-3 賽制）；固定打滿也讓 `score`（獲勝局數）的可能範圍精確等於 `0～N`，`maxReasonableScore()` 可以用選項上限（10）當作精確上限，而非像其他遊戲只能抓寬裕估計值。
   - 替代方案：傳統 best-of-N（先贏過半數即提前結束，例如 Bo5 先贏 3 局就結束）——放棄，因為使用者已明確指定「3 局後結束」的字面規則，且提前終止會讓「這場選了幾局」與「score 上限」的對應關係變得不固定，徒增複雜度。

4. **單局採定點賽制：先取得 `ROUND_POINT_TARGET`（初始估計 5 分）者贏得該局**
   - 理由：經典 Pong 就是「先得 N 分贏一局」的規則；5 分讓單局時間夠短（配合最長 10 局的賽制，整場遊戲總時長仍可控），初始估計值，比照 match3 的時間／步數常數，屬於「先讓機制跑起來，之後可依實測調整」。
   - 替代方案：單局改成限時制（比照 match3 rush 的 60 秒倒數）——放棄，Pong 的「一局」概念在真實世界就是分數制而非時間制，維持分數制更貼近玩家對這個經典玩法的既有預期。

5. **Server／API／client 資料層完全比照既有慣例擴充，不做任何架構調整**
   - `RETRO_GAME_BASE` 不變、`server/api/games/retro/<game>/history.*` 資料夾樣式不變、`app/services/api.ts` 的 `api.games.retro.*` 命名方式不變、`useGameHistory.ts` 的 `GAME_KEYS`／`_handlers.gameApi()` switch 擴充一個分支即可，`server/middleware/auth.ts` 的 `/api/games` 前綴保護與 `BalanceChangeType` 的 `'game-reward'` 皆已涵蓋，不需修改。

6. **Coin 倍率：`coinRate = 10`，`coinCapPerRun = 100`，`coinDailyCap = 100000`（沿用既有慣例），`maxReasonableScore() = 10`**
   - 理由：沿用 `add-game-history` Decision 10／`add-match3-games` Decision 5 的既有做法——每款遊戲的原始分數量級不同，各自校準倍率讓「一場普通局」的預期收益（~100 coin）在遊戲間大致接近。PONG 的 `score` 上限精確等於「最大可選局數」（10），若玩家選 10 局且全勝，`score = 10`，`10 × coinRate(10) = 100 coin`，剛好對齊既有「一場優秀表現 ≈ 100 coin」的量級；`coinCapPerRun = 100` 在此情境下等於理論最大值，屬於防呆保險（理論上不會真的被夾住，除非未來調整局數選項上限）。
   - 與其他遊戲的差異：`maxReasonableScore()` 對 PONG 而言是**精確**上限（`score` 定義上不可能超過 10），不像 snake／racing／tetriminos／match3 只能抓寬裕估計值；這點在 server 端 `pong.ts` 的註解需要特別說明，避免日後有人誤以為是估算值而調高。

7. **不做難度隨局數升級，維持單一固定難度 CPU**
   - 理由：見 Non-Goals；`score` 範圍只有 0～10，區間太窄不適合當作難度曲線的驅動信號，且使用者本次並未要求難度設計（不同於 match3 當時使用者有明確拍板）。維持單一難度也降低本次規劃與後續實作的範疇。
   - 若未來要做，建議改用「目前打到第幾局」而非「score」當作難度驅動信號（例如：CPU 反應速度隨局數推進小幅提升），因為「第幾局」在賽制固定後是可預期、線性遞增的信號，不受勝負影響。

8. **PONG 的 `useGameHistory` payload 額外帶 `meta: { totalRounds, roundsWon, roundsLost }`，不使用 `level` 欄位**
   - 理由：`level` 欄位在既有五款遊戲的語意都是「難度等級」，PONG 沒有難度分級（見 Decision 7），若硬塞局數選項（3/5/10）進 `level` 欄位、在 `GameHistoryDialog.vue` 顯示成「Lv.5」會誤導成難度等級而非局數，語意不符。
   - 做法：局數資訊改放 `meta`（非破壞性欄位，比照 snake 現況：`fruitCount` 也是存在 `meta` 但目前 `GameHistoryDialog.vue` 並未渲染），為未來如果要在 Dialog 顯示「3 戰 2 勝」之類的細節預留資料，但本次不強制要求同步改 Dialog UI。

## Risks / Trade-offs

- [風險] CPU 難度是程式碼估算值（追蹤速度上限／反應延遲），可能太簡單（玩家永遠 5:0 全勝，score 恆為 N）或太難（玩家永遠 0:5 落敗，score 恆為 0），兩種極端都會讓「贏幾局」這個分數設計失去鑑別度 → [因應] 比照 match3 既有做法：先讓機制跑起來，於 tasks 的驗證步驟中實際試玩多局，依體感調整 CPU 速度／反應延遲常數，不影響架構本身。
- [風險] 單局定點賽制（5 分制）若打得势均力敵，單局時間可能拖長，10 局制的總時長會明顯比其他單局定額（時間/步數）的遊戲久 → [因應] `ROUND_POINT_TARGET` 訂為獨立常數，上線後可依實測時長調降（例如改成 3 分制），不影響 `score`（獲勝局數）的定義與資料層設計。
- [風險] `score` 語意（獲勝局數）與既有五款遊戲（原始表現值）不同，若日後有人在 `GameHistoryDialog.vue` 或其他共用邏輯裡對 `score` 做「假設數值量級跟其他遊戲相近」的處理，可能誤用 → [因應] 已在 proposal 的 Capabilities 段與本文件 Decision 2 明確標註分數定義差異；`coinRate`／`maxReasonableScore()` 各自獨立設定，不共用任何跨遊戲的分數假設，架構上已隔離此風險。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成獨立的 `gameKey`，不影響既有五款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照 `add-game-history`／`add-match3-games` 既有的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts` 擴充
  4. `useGameHistory.ts` 擴充
  5. 遊戲頁面 `app/pages/game/pong.vue`（此步驟起才有實際資料寫入行為）
  6. `game-hall.vue` + `GameMachineCard.vue` + `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- CPU 難度是否要隨局數推進小幅提升（例如第 8-10 局比第 1-3 局稍快）？本次先維持單一固定難度，待實測後再評估（見 Decision 7）。
- `ROUND_POINT_TARGET`（單局目標分數）、CPU 追蹤速度／反應延遲、`coinRate` 皆為拍腦袋估算，上線後建議實際玩幾場記錄勝率分佈再校準（比照 `add-game-history`／`add-match3-games` 對其他遊戲常數的既有 Follow-up 做法）。
- 是否要在 `GameHistoryDialog.vue` 實際顯示 PONG 的 `meta`（例如「3 戰 2 勝」）？本次先只落地資料欄位，UI 呈現留待後續一併檢視所有遊戲的 `meta` 顯示需求時再處理。
