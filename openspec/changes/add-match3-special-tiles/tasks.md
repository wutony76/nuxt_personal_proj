## 1. 核心引擎

- [x] 1.1 `app/utils/match3Engine.ts`：新增平行的 `special: Match3SpecialKind[][]` 陣列，`swapCells`／`clearAndRefill` 同步搬移顏色與特殊種類
- [x] 1.2 `findMatchGroups()` 取代 `findMatches()`：回傳帶形狀（line3/line4/line5plus/corner）與方向資訊的群組，特殊方塊格排除在被動連線偵測之外
- [x] 1.3 引爆／連鎖清除演算法：worklist 處理特殊方塊被消除／被爆炸波及／被連鎖觸發，Line Bomb／Bomb 優先於 Color Bomb 處理
- [x] 1.4 Color Bomb 目標色判定（玩家交換觸發／連鎖波及觸發／雙 Color Bomb 互換 fallback，三種情境）
- [x] 1.5 玩家直接交換特殊方塊分支：永遠合法、必定觸發；雙特殊方塊互換各自獨立引爆
- [x] 1.6 Combo 計分模型取代原公式，含 `COMBO_CAP`／`ROUND_SCORE_CAP`／`CHAIN_SCORE_CAP` 封頂
- [x] 1.7 `hasAnyValidMove()` 改用 `findMatchGroups()`；洗牌邏輯改為特殊方塊感知（`reshuffleKeepingSpecials()`，保留既有特殊方塊）

## 2. 遊戲頁面

- [x] 2.1 `match3-rush.vue`、`match3-classic.vue`：`Match3RushEngine`／`Match3ClassicEngine` 的 `getSnapshot()` 傳遞 `special` 陣列
- [x] 2.2 棋盤格渲染特殊方塊圖示（💣／🌈／↔️／↕️）與發光樣式
- [x] 2.3 Combo 彈出文字從 ×1 起顯示，字體大小隨 Combo 數值縮放
- [x] 2.4 RULE dialog 的玩法說明與計分公式文字同步更新，反映新機制

## 3. OpenSpec 文件

- [x] 3.1 `proposal.md` / `design.md` / `tasks.md`（本次變更文件本身）

## 4. 驗證

- [x] 4.1 `npx nuxt typecheck` 確認新增/修改的檔案皆無型別錯誤
- [x] 4.2 用 Playwright 隨機操作近 1200 次交換，確認 4 種特殊方塊皆能自然生成、無 console 錯誤、無卡死
- [x] 4.3 確認直接交換特殊方塊會觸發（分數正確變化）
- [ ] 4.4 實際玩測幾局記錄分數分佈，評估 coinRate／maxReasonableScore／Lv 門檻是否需要重新校準（待後續實測，非本輪程式碼變更範圍）
