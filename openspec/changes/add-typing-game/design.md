## Context

- `add-game-history` 已建立 game-hall 小遊戲的完整架構：client 頁面自包含（engine class + reactive 鏡像 snapshot）＋ `useGameHistory`（A/B 雙模式）＋ server 端 `RETRO_GAME_BASE`（共用基底＋每款遊戲一個服務檔＋每款遊戲一組 API 路由資料夾）。
- 現有 12 款遊戲的邏輯組織方式：10 款是「inline class 寫在單一 .vue 檔案內」，只有 MATCH3 系列與 SOLITAIRE 因為規則複雜度高（或需要共用）才把核心抽成獨立檔案（`app/utils/match3Engine.ts`／`app/utils/solitaireEngine.ts`）。TYPING 只有一個變體、規則單純（字串前綴比對），比照多數遊戲慣例整個寫在 `app/pages/game/typing.vue` 內，不額外拆檔。
- TYPING 的性質（持續生成物件、物件隨時間移動、難度隨時間遞增、生命值機制）跟 `SPACE SHOOTER`／`SPACE INVADERS` 高度相似，比 `MINESWEEPER`／`SOLITAIRE` 那種「純點擊、無 tick」的類型更接近，因此比照 `space-shooter.vue` 的 `setInterval(step, 16ms)` tick-driven 慣例，而不是回合制模式。
- 現有遊戲的鍵盤輸入都只篩選固定的方向鍵／WASD／空白鍵／Enter（已用 grep 確認 `event.key.toLowerCase()` 的既有用法皆為此類），沒有任何一款需要捕捉任意可印字元。TYPING 是首例，但沿用既有 `window.addEventListener('keydown', ...)` 模式，只是判斷條件改成「單一可印字元」，不是新架構（見 Decision 2）。

## Goals / Non-Goals

**Goals:**
- 提供打字反應玩法：畫面持續生成單字、玩家逐字元輸入、完成即得分並飄走、隨時間加速加難。
- 多字同時在畫面上時有明確的鎖定機制（見 Decision 1），輸入不分大小寫（見 Decision 2，使用者明確要求）。
- 生命值機制（3 條命）沿用 SPACE SHOOTER 已驗證的「扣命＋連擊歸零」做法，不重新設計。
- Server 端、client 資料層、game-hall 入口完全比照既有十二款遊戲的慣例逐一擴充，不引入資料庫。

**Non-Goals:**
- 不做多語言／中文輸入法支援，只支援英文字母／數字等單一可印字元的直接比對。
- 不做自訂單字庫、不串接外部字典 API；單字池是專案內建的固定陣列。
- 不做每日挑戰／成就／排行榜／統計。
- 不引入資料庫、不做遊戲重播，只存結算後摘要（分數、等級）。
- 不影響既有十二款遊戲的程式碼與行為。

## Decisions

1. **多字鎖定機制：打下第一個字元時，自動鎖定「所有待打單字中第一個字元相符」的一個，鎖定後排他比對**
   - 理由：規格畫面範例同時顯示多個單字（HELLO/WORLD/PIXEL/GAME），但沒有明講玩家怎麼決定要打哪一個；比照經典打字反應遊戲（Typing of the Dead／ZType）的既有慣例，是這個 genre 最直覺、也最容易實作的做法——不需要滑鼠選取或額外的目標指示 UI。
   - 做法：`TypingEngine` 維護 `words: WordObject[]`，每個物件有 `state: 'waiting'|'typing'|'completed'|'missed'`；`handleChar(char)` 若目前沒有 `typing` 狀態的字，就在 `waiting` 字中找 `text[0]` 等於輸入字元（不分大小寫）的候選（有多個時取最早生成、即 y 座標最大／最接近底部的那個），將其 state 切成 `typing` 並記錄 `progress=1`；若已有 `typing` 中的字，直接比對下一個字元。
   - 替代方案：滑鼠點擊選字後才能輸入——放棄，額外的選取步驟違背「打字遊戲要快、要直覺」的核心體驗，且規格本身沒有提到滑鼠操作。

2. **輸入比對不分大小寫**（使用者明確要求）
   - 理由：一般打字遊戲不要求玩家分辨大小寫（尤其中文鍵盤使用者不會特別按 Shift），只驗證字母本身；比照使用者需求直接採用。
   - 做法：單字池統一儲存為大寫顯示（`HELLO`），比對時把 `event.key` 與目標字元都 `toLowerCase()` 後比較；畫面固定顯示大寫（符合整體 PIXEL/RETRO 大寫美術風格），不因玩家實際按了大小寫而改變顯示。
   - **實作中發現並修正的 bug**：`handleChar()` 在「尚未鎖定任何字」的分支下，原本若輸入的字元不匹配任何待打單字的開頭字母，會直接回傳空結果、沒有觸發錯誤視覺回饋，跟「已鎖定但輸入下一個字元錯誤」的情況待遇不一致，不符合本節「輸入錯誤時提供明確視覺回饋」的既有需求（見下方「逐字元驗證」Requirement）。已修正為兩種情況都回傳 `wrong: true`，用 Playwright 實測確認修正前後行為差異。

3. **Game Loop：tick-driven，比照 `SpaceShooterEngine` 組織方式，不做成回合制**
   - 理由：見 Context，TYPING 需要連續的位置更新（單字上飄）與時間驅動的生成/難度邏輯，跟 MINESWEEPER／SOLITAIRE 的純點擊模式不同類型。
   - 做法：`TICK_MS = 16`，`step()` 每幀處理：（1）所有 `typing`／`waiting` 單字的 `y` 座標遞減；（2）y 超過畫面頂端的單字判定 `missed`（扣命、連擊歸零，若該字正是目前鎖定中的字則同時解鎖）；（3）生成倒數 `spawnCountdown` 遞減到 0 就 `spawnWord()` 並依等級重置倒數。

4. **生命值機制：3 條命，MISS 扣 1 命，命數歸零才 `GAME_OVER`**（比照 SPACE SHOOTER 先例）
   - 理由：規格的 Text Object state 有 `MISSED` 但沒明講後果；比照 SPACE SHOOTER 已驗證過的「多條命、輸入失誤不會立即結束遊戲」設計，符合這個 genre 的既有玩家預期（不會因為漏接一個字就整局結束）。
   - 做法：`lives = 3`，`step()` 判定 MISS 時 `lives -= 1`，`lives <= 0` 時 `gameOver = true`。不做無敵時間（MISS 不是碰撞傷害，沒有連續判定的問題，扣命後遊戲繼續即可，不需要 SPACE SHOOTER 那種無敵幀機制）。

5. **計分模型：字長 × 10 × 連擊倍率累加，開放式無上限**（比照 SPACE SHOOTER 的 combo 機制）
   - 理由：字越長打起來越花時間、越有挑戰性，給分應該跟字長正相關；連擊倍率鼓勵玩家保持連續完成，不中斷（不 MISS）。
   - 做法：完成一個字 `gained = text.length * 10 * multiplier`；`comboCount` 每次完成 +1，倍率依門檻分級（沿用 SPACE SHOOTER 的 `[0,5,12,24]→[x1,x2,x3,x4]` 門檻，字數規模不同但相對節奏類似，先估算，上線後校準）；MISS 時 `comboCount`／`multiplier` 歸零。
   - 估算：`coinRate: 0.3`、`coinCapPerRun: 300`、`coinDailyCap: 100000`（比照多數遊戲預設）、`maxReasonableScore(): 8000`（防偽造寬裕上限，比照 SPACE INVADERS 的估算方式）。這些是估算值，上線後依實測校準。

6. **難度曲線：等級隨分數提升，生成間隔縮短＋單字池混入更長的字**（比照既有「Lv 隨進度提升」慣例）
   - 理由：符合規格「隨時間增加，文字出現速度提高／文字越來越長」的要求，且跟現有遊戲的難度曲線手法一致，不需要新設計。
   - 做法：`LEVEL_SCORE_THRESHOLDS` 分級（比照 SPACE SHOOTER 的做法反推）；單字池依長度分層（例如 Lv1：3~5 字母常見英文單字，Lv3 起混入 6~8 字母），等級越高抽到長字的機率越高；`spawnCountdown` 的基礎值隨等級遞減，有下限。單字池是專案內建的固定陣列（依長度分組），不外接 API、不使用圖片。

7. **Server／API／client 資料層完全比照既有慣例擴充，不做任何架構調整**
   - `RETRO_GAME_BASE` 不變、`server/api/games/retro/<game>/history.*` 資料夾樣式不變、`app/services/api.ts` 的 `api.games.retro.*` 命名方式不變、`useGameHistory.ts` 的 `GAME_KEYS`／`_handlers.gameApi()` switch 擴充一個分支即可。
   - `gameKey` 採用 `'typing'`，路由路徑採 `typing`（單一英文字，不需要 kebab-case 轉換）。

## Risks / Trade-offs

- [風險] 鎖定機制（Decision 1）在極端情況下（畫面上多個字剛好同一個開頭字母）可能讓玩家覺得「鎖錯字」——因應：優先鎖定最接近底部（最快要 MISS）的候選，符合玩家「先處理最急迫的字」的直覺，且鎖定後畫面會有明確高亮，玩家可以立即看到鎖定結果並調整輸入策略。
- [風險] 難度曲線（生成間隔、單字池分層門檻）皆為拍腦袋估算，可能太難（來不及打）或太簡單（太久沒有壓力）——因應：比照既有遊戲做法，先讓機制跑起來，上線後依實測校準，不影響架構本身。
- [風險] 連擊倍率門檻直接沿用 SPACE SHOOTER 的數值，但兩者的「事件密度」（多久觸發一次 combo）不同（打字通常比擊落敵機慢），门檻可能需要重新校準——因應：門檻是獨立常數，上線後可單獨調整。
- [風險] coin 倍率是估算值，可能跟其他遊戲的 coin/分鐘產出有落差——因應：`coinRate`／`maxReasonableScore` 是獨立於 `typing.ts` 的常數，上線後可單獨調整。

## Migration Plan

- 全新功能，無既有資料需要遷移，刻意設計成獨立的 `gameKey`，不影響既有十二款遊戲的紀錄與 coin 上限。
- 部署順序（每一步都可獨立回滾，比照既有幾次擴充的分步策略）：
  1. Server 端服務層與 `storage.ts` 註冊（尚未被路由引用，無風險）
  2. Server 端 API 路由（存在但尚未被前端呼叫，無風險）
  3. Client `app/services/api.ts`／`useGameHistory.ts` 擴充
  4. 遊戲頁面 `app/pages/game/typing.vue`（此步驟起才有實際資料寫入行為）
  5. `game-hall.vue` + `gameSprites.ts` + `GameHistoryDialog.vue`（此步驟起使用者才看得到入口，是唯一改變可見行為的步驟）

## Open Questions

- 鎖定候選字的「優先順序」（最接近底部 vs 最早生成）上線後應實測手感，必要時調整。
- 難度曲線（生成間隔、單字池分層、連擊門檻）皆為估算值，上線後應依實測校準。
- 是否要在 HUD 額外顯示「目前等級」？屬於實作細節，留待實作階段決定，不影響本次架構規劃。
