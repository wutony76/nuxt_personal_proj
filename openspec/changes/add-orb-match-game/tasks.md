## 1. 核心邏輯（可獨立重用，抽成 utils）

- [x] 1.1 新增 `app/utils/orbMatchEngine.ts`：`OrbMatchCoreEngine`，棋盤資料模型（`rows`/`cols` 而非正方形 `size`）、`findMatches`/`clearAndRefill`/`hasAnyValidMove`/`createSolvableGrid` 整段移植自 `match3RushEngine.ts` 無特殊珠版本（見 design.md Decision 2）
- [x] 1.2 `moveHeldOrb(from,to)`：單步相鄰交換，不檢查消除（拖曳中呼叫）
- [x] 1.3 `resolve()`：放開手指/逾時時呼叫一次，掃描消除→清除補位→再掃描直到無新消除，回傳 `{matched, cascadeRounds, gained, reshuffled, hadCorner}`
- [x] 1.4 `findMatchGroups()`：比照 `match3Engine.ts` 的轉角合併判定，恰好 3 格的橫向/縱向 run 共用一格合併成 `isCorner: true` 的群組，≥4 格長 run 不參與合併；`findMatches()` 改為呼叫並攤平去重（見 design.md Decision 2／2b）
- [x] 1.5 `resolve()` 逐組計分：`isCorner` 的組別分數再乘上 `CORNER_BONUS_MULTIPLIER(1.5)`，並回傳 `hadCorner` 供 UI 顯示加成提示

## 2. Server 端服務層

- [x] 2.1 新增 `server/services/game/retro/orbMatch.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.25`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 6000`，見 design.md Decision 9）
- [x] 2.2 `server/services/storage.ts`：`gamesInitRetro()` 新增 import 並 `new` 該類別

## 3. Server 端 API 路由

- [x] 3.1 新增 `server/api/games/retro/orb-match/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有樣板）
- [x] 3.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 4. Client API 層

- [x] 4.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'orbMatch'`，`api.games.retro` 新增對應 3 個函式；連帶修正 `app/pages/admin/games.vue`（`Record<RetroGameKey, string>` 窮舉對照表）因擴充型別而缺漏的一筆，避免打斷該功能的 typecheck

## 5. Client 資料層

- [x] 5.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 6. 遊戲頁面互動與流程

- [x] 6.1 `app/pages/game/orb-match.vue`：`OrbMatchEngine` 薄包裝 class（整場倒數＋單次拖曳倒數＋拖曳路徑折算，見 design.md Decision 5／6）
- [x] 6.2 WELCOME／READY／RESULT 三段式 overlay（比照既有遊戲慣例）
- [x] 6.3 Pointer 互動：`pointerdown` 拿起珠子、`pointermove` 依座標換算 row/col 推進 `dragTo()`、`pointerup`／`pointercancel` 放開手指觸發結算（見 design.md Decision 6／7）；`setPointerCapture` 確保移出棋盤範圍仍能收到事件
- [x] 6.4 拖曳中的珠子疊層：`state.ghost` 絕對定位跟隨指標座標，held 格不重複渲染 emoji（見 Decision 7）
- [x] 6.5 HUD：SCORE／整場倒數 TIME／拖曳中顯示 DRAG 倒數；COMBO 短暫提示（比照 MATCH3 的 `comboText` 手法），命中 L/T 形連線時在提示前加註「L/T CONNECT!」
- [x] 6.6 棋盤改為 8 欄 × 8 列：`.om-board` CSS Grid 與 `.om-ghost` 疊層尺寸比例同步從 `6/5` 改成 `1/1` 正方形，格子字級因應縮小
- [x] 6.7 暫停時若正在拖曳，先強制結算一次再進入 PAUSE，避免暫停狀態下殘留未結算的拖曳
- [x] 6.8 RESULT overlay 顯示最終 SCORE，呼叫 `useGameHistory().actions.record()`
- [x] 6.9 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#9d4edd`（紫色，不與現有十四款遊戲撞色）
- [x] 6.10 不使用任何外部圖片素材，不複製任何特定遊戲的 Logo/UI（純 CSS 色塊與 emoji，符合使用者明確要求）

## 7. game-hall 入口

- [x] 7.1 `app/config/gameSprites.ts`：新增 `orbMatch` 項目（icon 🔮，重用既有 `sparkle` 動畫類型，不需新增 `@keyframes`）
- [x] 7.2 `app/components/GameHallSprites.vue`：`BASE_PLACEMENTS` 新增一筆固定座標
- [x] 7.3 `app/pages/game-hall.vue`：`gameSlots` 陣列新增 `{ id: 15, name: 'ORB MATCH', status: 'open', path: '/game/orb-match' }`
- [x] 7.4 `app/components/GameHistoryDialog.vue`：篩選 tab／`GAME_KEYS`／遊戲名稱對照各新增一筆

## 8. OpenSpec 文件

- [x] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [x] 9.1 `npm run dev` 啟動後，用 Playwright 實測完整流程：按住珠子拖曳跨格（DOM 檢查確認 ghost 疊層位置/文字/held 格皆正確）、放開手指觸發消除、連鎖加分正確顯示（實測一次相鄰交換觸發 3 消，SCORE 0→12，符合 `3格×4×1倍`公式）
- [x] 9.2 實測單次拖曳倒數 5 秒歸零會自動結算（不需放開手指）：持續按住 5.6 秒後 `dragging` 旗標自動變回 false
- [ ] 9.3 實測整場 90 秒倒數歸零會強制結算並顯示 RESULT——邏輯與 MATCH3 RUSH 的 `startCountdownLoop` 完全同構，程式碼審閱確認正確，未實際等滿 90 秒操作驗證
- [x] 9.4 實測拖曳中連續跨格移動、盤面即時反映交換，過程中未觸發消除（`resolve()` 只在 `pointerup`/逾時呼叫，程式碼路徑確認拖曳中無任何呼叫路徑會呼叫到 `findMatches`）
- [ ] 9.5 實測暫停時若正在拖曳會先強制結算，不會殘留未結算狀態——程式碼審閱確認 `pauseGame()` 內有此邏輯，未實際操作驗證
- [x] 9.6 未登入：Playwright 實測確認寫入 `localStorage`（key `game-history-v1`），紀錄含正確的 `gameKey: 'orbMatch'`／`score`
- [ ] 9.7 已登入：coin 結算邏輯與其他十四款遊戲共用同一個 `RETRO_GAME_BASE`，架構上一致，留待人工驗證
- [ ] 9.8 `GameHistoryDialog` 篩選 tab 能正確顯示 `ORB MATCH` 紀錄與統計——程式碼已加對應項目，尚未實際點開 dialog 驗證畫面
- [x] 9.9 `game-hall.vue` 卡片正常顯示（Playwright 確認頁面含「ORB MATCH」、開放中數量顯示 15），`/game/orb-match` 直接導航可正常進入遊戲
- [x] 9.10 確認既有十四款遊戲程式碼完全未被修改（僅共用檔案新增分支，未動既有分支邏輯；另修正了 `app/pages/admin/games.vue` 因型別擴充缺漏的一筆對照，屬於維持其 typecheck 通過的必要最小修正，非本次遊戲功能範圍）
- [x] 9.11 `npx nuxt typecheck`：新增/修改的檔案皆無型別錯誤；專案既有的 lottery/6hc/kl8/kl10 相關型別錯誤與本次變更無關（修改前即存在）
- [x] 9.12 Playwright 實測 8 欄 × 8 列棋盤正確渲染（64 格、正方形版面）
- [x] 9.13 Playwright 實測 L/T 形連線觸發加分：窮舉相鄰交換直到命中轉角連線，確認 combo 文字正確顯示「L/T CONNECT!」前綴、分數有明顯增加；計分公式本身（`group.cells.length * 4 * 連鎖倍率 * (isCorner ? 1.5 : 1)`）以程式碼審閱確認邏輯正確，因重力補位含隨機數、多輪連鎖場景難以在測試腳本中獨立重算精確數值逐一比對
