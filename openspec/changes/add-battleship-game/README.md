# add-battleship-game

遊戲中心新增 BATTLESHIP 傳統戰艦遊戲（Player vs AI）：10×10 雙棋盤（己方海域／敵方海域）、5 種戰艦（Carrier/Battleship/Cruiser/Submarine/Destroyer，共 17 格）、無拖曳的點擊式佈局（選船→切換方向→點格預覽→確認）、回合制攻擊（HIT/MISS/SUNK 判定＋防重複攻擊）、AI 隨機佈局與隨機攻擊，比照既有十五款遊戲的架構擴充；規則核心抽成 `app/utils/battleshipEngine.ts`（比照 match3Engine.ts／solitaireEngine.ts 先例）。Hunt & Target 智慧 AI、命中特效動畫、音效與特殊武器留待後續變更擴充，本次只做 MVP。
