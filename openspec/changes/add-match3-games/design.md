## Context

- `add-game-history` 已建立 game-hall 小遊戲的完整架構：client 頁面自包含（engine class + ref 鏡像 snapshot）＋ `useGameHistory`（A/B 雙模式：未登入 localStorage／已登入 server API）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）。
- 三款現有遊戲（snake/racing/tetriminos）每個頁面完全自包含、互不共用邏輯（包含各自重新實作的 engine class），這是既有慣例。
- 使用者明確要求 Match3 三消拆成「限時制」「限步數制」兩款**完全獨立**的遊戲，而非一款可切換模式的遊戲。

## Goals / Non-Goals

**Goals:**
- 兩款 Match3 遊戲（RUSH／CLASSIC）各自有獨立的分數紀錄、coin 每日上限、game-hall 卡片入口，互不干擾。
- 三消棋盤的核心演算法（交換／連鎖消除／掉落補位／無解偵測）只寫一份，兩款遊戲共用，避免日後修 bug 要改兩次。
- Server 端、client 資料層、game-hall 入口完全比照 snake/racing/tetriminos 的既有慣例逐一擴充，不引入新的架構模式。

**Non-Goals:**
- 不做排行榜、不做遊戲重播、不引入資料庫（沿用 in-memory）。
- 不做「登入時合併本地與 server 紀錄」（沿用 `add-game-history` 既有的 Non-Goal）。
- 不做後台可調參數介面（coinRate 等常數仍寫死在服務檔建構子，比照現有三款遊戲的既有限制與 Follow-up）。

## Decisions

1. **拆成兩款完全獨立的遊戲，而非一款可切換模式的遊戲**
   - 理由：使用者明確拍板。獨立遊戲代表獨立的 `gameKey`、獨立的 coin 每日上限、game-hall 各自一張卡片，符合「互不干擾」的要求——例如玩家不會因為兩種模式共用同一個每日 coin 上限而互相排擠額度。
   - 取捨：server 端與 client 資料層的樣板檔案數量比新增一款遊戲多一倍（兩組 API 路由、兩個服務檔），但每一份都很薄，且完全比照既有慣例複製，維護成本可控。

2. **抽出共用的 `Match3CoreEngine`，是本次唯一偏離「每頁面完全自包含 engine」既有慣例之處**
   - 理由：snake/racing/tetriminos 三款遊戲彼此的玩法邏輯完全不同，複製貼上沒有共用必要；但 Match3 RUSH／CLASSIC 的棋盤消除演算法（交換合法性、連鎖消除、掉落補位、無解洗牌）逐字相同，只有「結束條件」不同。若照舊例整份複製，會複製一份複雜度較高的演算法，違反 `openspec/project.md` 的「複雜業務邏輯與 API 處理必須抽離至 Class / Service」強制規範，日後任何一個消除規則的 bug 都要改兩處、容易漏改。
   - 做法：`Match3CoreEngine` 放在 `app/utils/match3Engine.ts`（比照專案 `Frontend helper functions are under app/utils/` 的既有分類），純邏輯、不依賴 Vue，兩個頁面各自在 `<script setup>` 內定義一個很薄的包裝 class（`Match3RushEngine`／`Match3ClassicEngine`，內部持有一個 `Match3CoreEngine` 實例），只處理計時／計步的結束條件——這部分依然比照 snake.vue 的 `SnakeEngine` inline class 慣例，維持「頁面擁有自己的 engine 實例」這個既有模式，只是消除邏輯的實作被下放到共用工具。
   - 替代方案：完全比照舊例、兩個頁面各自複製一份完整消除演算法——放棄，違反強制規範且維護成本明顯更高。

3. **棋盤與計分數值：8×8 棋盤、6 種寶石、連鎖 combo 加成**
   - 每次交換若形成 3 連消（含）以上即成立，觸發連鎖：清除→掉落→補新寶石→重新偵測，直到沒有新消除為止。
   - 計分：每輪清除 `matchedCount × 10 × (1 + (round-1) × 0.5)`，round 從 1 起算，四捨五入。連鎖輪數越多分數加成越高，符合三消遊戲玩家對「connect combo」的預期回饋。
   - 交換後若沒有任何合法移動，自動重新洗牌（不消耗步數／時間，靜默重排），避免死局。這是三消遊戲的標準做法。

4. **限時制（RUSH）：60 秒倒數；限步數制（CLASSIC）：20 步，只有成功消除的交換才消耗一步**
   - 理由：無效交換（未形成消除）本來就會自動復位，若也扣一步，誤觸的體驗會很差；比照多數三消遊戲慣例（如 Candy Crush），只有真正形成消除的交換才計入步數。
   - 這兩個數值是初始估計值，如同 `add-game-history` design.md 的 coin 倍率一樣，屬於「先讓機制跑起來，之後可依實測調整」的常數，不影響架構本身。

5. **RetroGameKey 新增 `'match3rush'`、`'match3classic'` 兩個獨立 key，coin 常數各自校準**
   - 理由：沿用 `add-game-history` Decision 10 的既有做法——每款遊戲的原始分數量級不同，各自校準倍率讓「一場普通局」的預期收益（~100 coin）在遊戲間大致接近。
   - 初始倍率估算：普通一局清除數十次連鎖，總分落在數百到約 2000 分區間（RUSH 因為限時、手速快通常分數略高於 CLASSIC 的精算慢玩），暫抓兩者 `coinRate` 皆為 `0.1`（1000 分 ≈ 100 coin）。`coinCapPerRun` 沿用既有慣例 300，`coinDailyCap` 沿用既有慣例 100000。`maxReasonableScore()`（防呆上限，非玩法天花板）：RUSH 抓 20000、CLASSIC 抓 8000（步數受限，理論上限更低）。這些是程式碼估算值，上線後應如既有三款遊戲的 Follow-up 一樣，實測校準。

6. **Server／API／client 資料層完全比照既有慣例擴充，不做任何架構調整**
   - `RETRO_GAME_BASE` 不變、`server/api/games/retro/<game>/history.*` 資料夾樣式不變、`app/services/api.ts` 的 `api.games.retro.*` 命名方式不變、`useGameHistory.ts` 的 `GAME_KEYS`／`_handlers.gameApi()` switch 擴充分支即可，`server/middleware/auth.ts` 的 `/api/games` 前綴保護與 `BalanceChangeType` 的 `'game-reward'` 皆已涵蓋，不需修改。

7. **難度隨分數自動升級，比照 snake/racing/tetriminos 既有的「Lv 隨進度提升」慣例，而非真正的多關卡目標制**
   - 理由：使用者確認要補上難度/等級設計，但明確選擇比照現有三款遊戲的模式（單局衝分＋難度自動遞增），而非另建一套「過關解鎖下一關」的目標制（那需要關卡目標、關卡資料、過關畫面等全新結構，屬於不同規模的功能）。
   - 做法：`app/utils/match3Engine.ts` 新增共用的 `calcMatch3Level(score)`（依分數門檻 0/200/500/1000/2000 對應 Lv1-5）與 `calcMatch3TypeCount(level)`。Match3 是回合制交換玩法，沒有 snake/racing/tetriminos 那種「連續移動速度」可以加快，因此難度改用「寶石種類數」表現：等級越高，`Match3CoreEngine.setTypeCount()` 擴大寶石種類池（6→7→8 種），種類越多、同色連線的機率越低、找消除組合越難，是三消遊戲常見的難度手段。
   - 兩款遊戲的 `Match3RushEngine`／`Match3ClassicEngine` 各自在每次 `trySwap()` 後重新計算等級，等級變動時才呼叫 `setTypeCount()`（既有格子不變、只影響之後掉落補位／洗牌抽到的新寶石），並把 `level` 併入 `getSnapshot()`、`recordHistory()` 的 payload，比照既有三款遊戲把 `level` 一併寫入紀錄。

## Risks / Trade-offs

- [風險] `Match3CoreEngine` 是本次唯一新增的共用邏輯層，若日後又新增第三款三消變體，需要判斷是否該繼續放在同一個共用檔案或該拆分——目前先不預先設計擴充點，等真的有第三個使用場景再視情況調整（YAGNI）。
- [風險] coin 倍率／時間／步數皆為程式碼估算，非實測數據，可能出現「比其他遊戲好賺」或「太快/太慢結束」的失衡——因應方式同 `add-game-history`：倍率與時間/步數皆為獨立常數，不影響對外介面，上線後可直接調整數值。
- [風險] 無解自動洗牌若實作有誤可能導致無限迴圈——因應：`createSolvableGrid()` 用 `do...while(!hasAnyValidMove())` 迴圈重新產生棋盤，8×8/6 種寶石的組合空間下，機率上幾輪內必收斂，且該邏輯有明確的終止條件（找到有解棋盤才跳出）。

## Migration Plan

- 全新功能，無既有資料需要遷移，且刻意設計成完全獨立的 `gameKey`，不影響既有三款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照 `add-game-history` 既有的分步策略）：
  1. `Match3CoreEngine`（純前端工具函式，尚未被任何頁面引用，無風險）
  2. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  3. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  4. Client `app/services/api.ts` 擴充
  5. `useGameHistory.ts` 擴充
  6. 兩個遊戲頁面（此步驟起才有實際資料寫入行為）
  7. `game-hall.vue` + `GameMachineCard.vue` + `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- RUSH／CLASSIC 的 `coinRate`／時間／步數是拍腦袋估算，上線後建議實際玩幾局記錄分數分佈再校準（比照 `add-game-history` 對 racing/tetriminos 倍率的既有 Follow-up 做法）。
