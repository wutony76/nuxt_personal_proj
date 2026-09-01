# add-tower-stack-game

遊戲中心新增 **TOWER STACK** 一鍵堆塔遊戲：方塊沿水平方向來回移動，玩家點擊／Space／觸控使其落下並疊在塔頂；若位置偏移，只留下與上一層重疊的部分，未重疊的部分會掉落消失，塔身因此越疊越窄，完全沒有重疊時遊戲結束；幾乎完美對齊時判定 Perfect，維持原寬並累積 Combo 加分。核心「Overlap Detection → Block Resize → Falling Piece」演算法是本次架構首度出現、沒有既有先例可套用的部分，抽成獨立的 `app/utils/towerStackEngine.ts`；其餘 Server／Client 資料層、game-hall 入口比照既有十六款遊戲慣例逐一擴充。本次僅做 MVP（無 Hunt & Target 級的智慧演出效果、無複雜 Physics Engine），純 DOM/CSS 渲染，不使用 Canvas。
