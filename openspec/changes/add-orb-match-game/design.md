## Context

- `add-game-history` 已建立 game-hall 小遊戲的完整架構：client 頁面自包含（engine class + reactive 鏡像 snapshot）＋ `useGameHistory`（A/B 雙模式）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）。
- 現有兩款 MATCH3（RUSH／CLASSIC）的核心邏輯是全專案唯二抽成獨立檔案的遊戲邏輯（`app/utils/match3RushEngine.ts`／`app/utils/match3Engine.ts`），因為消除演算法本身有一定複雜度、且需要跟頁面端的計時/任務邏輯分層。ORB MATCH 的消除掃描／重力補齊／無解重洗邏輯跟「盤面怎麼被打亂的」完全無關，只認目前的 `grid` 陣列，因此直接整段移植 `match3RushEngine.ts` 的無特殊珠版本，抽成新檔 `app/utils/orbMatchEngine.ts`（見 Decision 2）。
- 全專案目前沒有任何拖曳／pointer／touch 輸入，包含 SOLITAIRE 這種直覺上該用拖曳的遊戲也是用兩次點擊選格。ORB MATCH 的「連續拖曳跨格」是本專案第一個拖曳型輸入，沒有既有模式可以直接抄（見 Decision 6）。
- 全專案零 `<canvas>`，MATCH3 用 CSS Grid + `v-for` 渲染格子，沒有位置動畫（瞬間重繪）。ORB MATCH 沿用「瞬間重繪」處理靜態格子，但拖曳中的珠子需要新增一個絕對定位疊層跟隨指標，才能有「跟著手指走」的手感（見 Decision 7）。

## Goals / Non-Goals

**Goals:**
- 提供轉珠核心玩法：按住珠子連續拖曳跨格、放開手指統一結算消除與連鎖。
- 消除掃描／重力補齊／無解重洗直接重用 MATCH3 RUSH 已驗證過的演算法，不重新設計。
- Server 端、client 資料層、game-hall 入口完全比照既有十四款遊戲的慣例逐一擴充，不引入資料庫。
- 不使用任何外部圖片素材，不複製任何特定遊戲的 Logo、素材、受版權保護 UI（使用者明確要求）。

**Non-Goals:**
- 不做特殊珠（Bomb／Line Bomb／Color Bomb）機制，維持單純三消（CLASSIC 已有這套機制，ORB MATCH 刻意不重複做）。
- 不做怪物／組隊／回合制戰鬥、技能珠、屬性克制等 RPG meta-game 元素，只做核心珠子消除玩法。
- 不做關卡選擇／自訂關卡編輯器；棋盤尺寸與屬性色數是固定常數。
- 不做每日挑戰／成就／排行榜／統計。
- 不做拖曳中珠子的位置補間動畫（除了被拖曳的那一顆），其餘格子維持專案既有的「瞬間重繪」慣例。
- 不引入資料庫、不做遊戲重播，只存結算後摘要（分數）。
- 不影響既有十四款遊戲的程式碼與行為。

## Decisions

1. **命名與 `gameKey`**：站內顯示名稱 **「ORB MATCH」**，`gameKey: 'orbMatch'`（比照 `spaceInvaders`／`spaceShooter` 的複合詞 camelCase 慣例，而非拼接成單一單字），路徑 `/game/orb-match`，API 路由 slug 沿用 kebab-case 慣例（比照 `space-invaders`／`space-shooter`）為 `orb-match`。

2. **消除／重力／連鎖演算法：整段移植 `match3RushEngine.ts` 的無特殊珠版本，抽成獨立檔案 `orbMatchEngine.ts`；另外加上比照 `match3Engine.ts` 的 L/T 形轉角合併判定，用於加分（不生成特殊珠）**
   - 理由：`findMatches`（run-length 掃描）、`clearAndRefill`（每欄由下往上補位）、`hasAnyValidMove`／`createSolvableGrid`（無解重洗）都是「棋盤資料模型」層級的邏輯，跟盤面是被單次交換還是連續拖曳打亂完全無關，直接重用可以省去重新驗證演算法正確性的成本。使用者後續明確要求「支援 L 形／T 形連線」，經確認後選擇「額外加分」而非「生成特殊珠」（見下方 Decision 2b），比照 `match3Engine.ts` 已驗證過的「恰好 3 的橫向 run 與恰好 3 的縱向 run 共用一格才合併」判定手法。
   - 做法：`OrbMatchCoreEngine` 建構子改吃獨立的 `rows`/`cols`（8×8，見 Decision 3），而不是 `match3RushEngine.ts` 原本的單一 `size`。所有掃描/補位迴圈比照原邏輯，只是把 `size` 拆成 `rows`/`cols` 兩個維度分別跑。`findMatches()` 改為內部呼叫新增的 `findMatchGroups()`（回傳 `{cells, isCorner}[]`）並攤平去重，維持原本給 `hasAnyValidMove()` 用的輕量介面不變。
   - 不重用之處：MATCH3 的 `trySwap(a,b)` 是「交換→立即檢查→不合法就復原」的單次原子操作；ORB MATCH 改成 `moveHeldOrb(from,to)`（單步交換，不檢查消除）+ `resolve()`（放開手指時才統一掃描結算一次），這是唯一偏離 MATCH3 交換語意的地方（見 Decision 6）。

2b. **L/T 形連線加分：`CORNER_BONUS_MULTIPLIER = 1.5`，不生成特殊珠**
   - 理由：使用者確認只要「額外加分」，不要 MATCH3 CLASSIC 那套 Bomb／Line Bomb／Color Bomb 特殊珠與連鎖引爆系統（複雜度大、且違背原本 Non-Goals）。技術上 L/T 形其實原本就會被消除（橫線+直線各自進同一個去重 `Set`，交叉點不會重複扣血），只是完全沒有額外加成、甚至因為去重讓總格數比兩條線分開算還低，等於變相「懲罰」轉角。
   - 做法：`findMatchGroups()` 回傳的每一組帶 `isCorner` 旗標；`resolve()` 逐組計分（`group.cells.length * 4 * 連鎖倍率`），`isCorner` 的組別再乘上 `CORNER_BONUS_MULTIPLIER`；`OrbMatchResolveResult` 新增 `hadCorner: boolean`，頁面端 `showCombo()` 偵測到時在 combo 文字前加上 `L/T CONNECT!` 提示，讓玩家看得出這次有拿到加成，而不是只在分數數字裡默默加成看不出來。
   - 合併範圍：只有「恰好 3 格」的橫向/縱向 run 才會合併成轉角組；≥4 格的長 run 不參與合併，各自獨立成組（比照 `match3Engine.ts` 的既有規則，避免例如「4 連橫線 + 3 連直線」這種不對稱組合的加成邏輯複雜化）。

3. **棋盤尺寸與屬性色：8 欄 × 8 列、6 種屬性珠，固定難度不隨分數變化**
   - 理由：原始規劃為了跟現有 MATCH3（8×8）做區隔而選了 6×5；使用者後續明確要求改回 8×8（更大的棋盤搭配新加入的 L/T 形連線機制，湊出轉角連線的機會也更多，兩者相輔相成）。不做 MATCH3 RUSH 那種「分數提升→屬性色數增加」的難度曲線，保持 MVP 範圍單純（見 Non-Goals）。
   - 做法：`BOARD_ROWS=8`、`BOARD_COLS=8`、`TYPE_COUNT=6` 不變，皆為頁面內常數；`.om-board` 的 CSS Grid 與 `.om-ghost` 疊層尺寸比例同步從 `6/5` 改成 `1/1`（正方形），格子內 emoji 字級因格子變小而略微縮小。未來如需難度曲線可仿照 RUSH 的 `calcMatch3RushTypeCount()` 模式擴充（見「未來可擴充項目」）。

4. **場次結構：整場 90 秒倒數，時間內可拖曳任意多次，時間到強制結算**
   - 理由：比照 MATCH3 RUSH 的「整體時間限制」模式，貼近轉珠遊戲「一直玩到沒時間」的直覺，不做 CLASSIC 那種固定步數模式，也不做傳統轉珠遊戲的怪物/組隊/回合制戰鬥（見 Non-Goals）。
   - 做法：`SESSION_SECONDS=90`，每 100ms tick 累積滿 1000ms 才把 `sessionTimeLeft -1`（避免用兩個獨立的 `setInterval` 分別對到不同精度造成計時漂移）。

5. **單次拖曳時限：5 秒，時間到自動視為放開手指**
   - 理由：傳統轉珠遊戲的核心難度來源是「拿起珠子後有限時可以拖曳」，這是這個 genre 的招牌手感，直接採用。
   - 做法：`DRAG_SECONDS=5`，`startDrag()` 時重置 `dragTimeLeft`，每 100ms tick 遞減；歸零時引擎內部直接呼叫 `endDrag()`（統一在引擎層處理，頁面端不需要另外判斷「是放開手指還是逾時」，兩者收斂成同一個 `finishDrag()` 收尾流程）。

6. **拖曳路徑如何折算成交換：`dragTo()` 逐格走位，過程中不檢查消除**（本專案第一個拖曳型輸入，沒有先例）
   - 理由：`pointermove` 事件的座標可能因為手指移動速度快而跳過中間格（例如一次事件就從 `(2,1)` 跳到 `(2,4)`），若直接把「手上的珠子」瞬移到目標格會漏掉中間格應該被交換的珠子，跟實際拖曳路徑不符。
   - 做法：`dragTo(target)` 用一個 while 迴圈，每次只往 row 或 col 方向移動一格（先消化 row 差距、再消化 col 差距），每一步都呼叫 `moveHeldOrb()`（保證步步合法相鄰交換），直到到達目標格或某一步交換失敗（理論上不會，因為每步都在棋盤範圍內）為止。拖曳全程（`pointerdown`→`pointermove`*N→`pointerup`）完全不呼叫 `findMatches()`，只在 `endDrag()`／逾時時呼叫一次 `resolve()`，這是刻意的設計：轉珠遊戲允許玩家「暫時排出連線又移開」而不觸發消除，只認放開手指當下的最終盤面。
   - 替代方案：每步交換後都立即檢查消除（比照 MATCH3 的 `trySwap`）——放棄，這樣會讓玩家沒辦法「先湊出一個大連鎖再放手」，失去轉珠遊戲的核心策略性，也不符合使用者要求的「傳統版本」手感。

7. **視覺呈現：拖曳中的珠子用 `position:absolute` 疊層跟隨指標，其餘格子維持 CSS Grid 排版**
   - 理由：CSS Grid 自動排版無法做到「珠子跟著手指連續移動」的視覺效果（因為底層資料是每次跨格交換才更新一次，屬於離散跳動），需要額外一層完全不受格線約束、直接綁定指標座標的疊層元素。
   - 做法：`state.ghost = {visible, type, x, y}`，`x`/`y` 是相對於棋盤容器（`boardRef`）左上角的像素座標，在 `pointermove` 時直接寫入（不經過 `moveHeldOrb`，純視覺，不影響資料模型）；棋盤格子渲染時，若目前格子等於引擎回報的 `heldPos`，就不畫該格的 emoji（改由疊層的 ghost 顯示同一個 emoji），避免同一顆珠子被畫兩次。放開後 ghost 隱藏，格子渲染回歸正常 CSS Grid 排版，不做位置補間動畫（維持跟全專案一致的低複雜度，見 Non-Goals）。
   - Pointer Events 選型：用 `pointerdown`/`pointermove`/`pointerup`/`pointercancel`（而非分開處理 `mouse*`/`touch*`）統一滑鼠與觸控，並在 `pointerdown` 時對棋盤容器呼叫 `setPointerCapture()`，確保手指/游標移出棋盤範圍時仍能持續收到 `pointermove`/`pointerup`。

8. **Game State：沿用既有 4 態 union type，拖曳中/拖曳倒數是 `playing` 狀態下的子欄位**
   - 理由：拖曳中與拖曳倒數本質上是「PLAYING 中的操作過程」，不需要暫停整個計時迴圈或改變頂層狀態機，比照 BREAKOUT 的 `BALL_LOST`/`LEVEL_CLEAR` 過場處理方式（見 add-breakout-game design.md Decision 6）。
   - 做法：`state.dragging`／`state.dragTimeLeft`／`state.heldPos` 是 `playing` 狀態下的子欄位；`state.comboText` 沿用 MATCH3 的短暫 combo 提示手法（`setTimeout` 後自動清除）。

9. **Server／API／client 資料層完全比照既有慣例擴充，不做任何架構調整**
   - `RETRO_GAME_BASE` 不變、`server/api/games/retro/<game>/history.*` 資料夾樣式不變、`app/services/api.ts` 的 `api.games.retro.*` 命名方式不變、`useGameHistory.ts` 的 `GAME_KEYS`／`_handlers.gameApi()` switch 擴充一個分支即可。
   - `coinRate: 0.25`、`coinCapPerRun: 300`、`coinDailyCap: 100000`（比照 MATCH3 RUSH 的估算值，因為計分公式完全相同），`maxReasonableScore(): 6000`（90 秒場次、無特殊珠加成，理論分數上限略低於 RUSH 的 60 秒場次搭配任務獎勵，抓寬裕上限做異常防護，不追求精確）。

## Risks / Trade-offs

- [風險] `dragTo()` 的逐格走位在 `pointermove` 事件密度不足（例如低刷新率裝置或滑鼠移動極快）時，可能感覺「跳格」而非連續滑動——因應：視覺上疊層 ghost 用連續指標座標渲染，感覺仍是平滑的，只有底層資料格子是離散跳動，玩家實際體感應該可以接受；上線後如果實測手感不對，可以考慮改用更高頻的 `requestAnimationFrame` 取樣。
- [風險] 拖曳倒數只有 5 秒，可能對不熟悉轉珠遊戲的玩家太短——因應：這是這個 genre 的既定慣例（見 Decision 5），且是獨立於棋盤/計分之外的常數，上線後可單獨調整不影響架構。
- [風險] 這是本專案第一個拖曳型輸入，`setPointerCapture`／`getBoundingClientRect` 在不同瀏覽器/裝置的行為可能有細微差異（尤其行動裝置觸控）——因應：Pointer Events 是現代瀏覽器標準 API，行為差異風險比分別處理 mouse/touch 事件低；上線後仍需要在實體行動裝置上額外測試觸控手感。
- [風險] 場次時間（90 秒）、拖曳時限（5 秒）、棋盤尺寸/屬性色數皆為拍腦袋估算，可能太難或太簡單——因應：比照既有遊戲做法，先讓機制跑起來，上線後依實測校準。
- [風險] coin 倍率是估算值，可能跟其他遊戲的 coin/分鐘產出有落差——因應：`coinRate`／`maxReasonableScore` 是獨立於 `orbMatch.ts` 的常數，上線後可單獨調整。

## Migration Plan

- 全新功能，無既有資料需要遷移，刻意設計成獨立的 `gameKey`，不影響既有十四款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. `app/utils/orbMatchEngine.ts`（尚未被任何頁面引用，無風險）
  2. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  3. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  4. Client `app/services/api.ts`／`useGameHistory.ts` 擴充
  5. 遊戲頁面 `app/pages/game/orb-match.vue`（此步驟起才有實際資料寫入行為）
  6. `game-hall.vue` + `gameSprites.ts` + `GameHallSprites.vue` + `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- `dragTo()` 逐格走位在極端快速滑動下的手感是否足夠流暢，上線後應實測（見 Risks）。
- 場次時間、拖曳時限、棋盤尺寸/屬性色數皆為估算值，上線後應依實測校準。
- 是否要比照 MATCH3 RUSH 加入隨分數提升的難度曲線（屬性色數增加）——暫定不做（見 Non-Goals），如有需求可另外提案擴充。

## 未來可擴充項目（尚未實作，僅記錄構想）

- **難度曲線**：目前屬性色數固定 6 種、棋盤尺寸固定，沒有隨分數/時間提升難度的機制。若要加入，可仿照 `match3RushEngine.ts` 的 `calcMatch3RushLevel`/`calcMatch3RushTypeCount` 模式。
- **特殊珠機制**：目前刻意不做 Bomb／Line Bomb／Color Bomb（見 Non-Goals）。若要加入，`match3Engine.ts`（CLASSIC）已有完整的特殊珠分類與連鎖引爆邏輯可參考，但屬於較大範圍的擴充，需要另外提案。
- 屬於 Non-Goals 之外、規格未要求的加分項，優先度低於現有的場次時間/拖曳時限/coin 倍率校準工作。
