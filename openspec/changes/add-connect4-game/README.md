# add-connect4-game

遊戲中心新增 **CONNECT 4** 四子棋遊戲（Player vs AI）：7×6 棋盤、玩家與 AI 輪流選擇欄位讓棋子重力落下，先在 Horizontal／Vertical／Diagonal 任一方向連成 4 子者獲勝，棋盤填滿無人連線則 Draw。比照 `add-battleship-game` 的回合制對戰架構（Turn 狀態機＋AI 延遲執行＋玩家與 AI 共用同一套判定純函式），規則核心抽成 `app/utils/connect4Engine.ts`，勝負判定集中為單一四方向掃描函式，同時供「實際落子後判斷勝負」與「AI 試下評估」共用。本次為第一階段規劃文件，僅產出架構分析與 MVP 順序供確認，尚未進入實作。AI 第一版採 Rule-Based（優先獲勝→優先阻擋→隨機合法欄），不引入 Minimax 等複雜策略。
