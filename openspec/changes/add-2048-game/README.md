# add-2048-game

遊戲中心新增復古像素風 **2048** 數字益智遊戲：4×4 棋盤、方向鍵／WASD／Touch Swipe 四向移動、相同數字碰撞合併（一次移動每格只合併一次）、每次有效移動後隨機新增一格 2（90%）或 4（10%）、合成 2048 顯示 WIN 但可繼續遊玩、無可移動位置時 Game Over，比照既有十六款遊戲的架構擴充。規則核心抽成 `app/utils/game2048Engine.ts`（比照 match3Engine.ts／battleshipEngine.ts 先例），Best Score 直接重用 `useGameHistory.ts` 既有的 `statsByGame`，不另建儲存機制。本次首度在專案中引入「Pointer 座標差量判斷四向 Swipe」的手勢偵測方式（先例為 orb-match 的拖曳偵測，但用途不同）。本次只做 MVP，動畫特效與棋盤尺寸變體留待後續變更。
