# add-lights-out-game

遊戲中心新增第 22 款復古像素風小遊戲 **LIGHTS OUT**：玩家點擊棋盤上任一格，該格與其上下左右合法鄰格會一起 XOR 切換 ON/OFF 狀態，目標是讓整片棋盤全部熄燈（全 OFF）才能過關，關卡越高棋盤越大或允許步數越少，比照既有 MINESWEEPER 的座標邊界判斷模式與 BREAKOUT 的關卡遞增模式擴充。規則核心抽成 `app/utils/lightsOutEngine.ts`（比照 `battleshipEngine.ts` 的 class + `getSnapshot()` 模式），本次只做 MVP：固定手動設計的關卡資料表、Toggle/Neighbor Toggle、Move Counter、Win Detection、Game Over（步數用盡）、Next Level、Restart、Pause、Keyboard、Touch、Pixel UI。Random Puzzle Generator、Hint、Undo、Best Moves、Challenge Mode 留待第二階段變更。

本文件為第一階段規劃性質（proposal → design → tasks → specs），尚未進入實作，也不修改任何既有程式碼。
