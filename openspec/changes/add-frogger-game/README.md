# add-frogger-game

遊戲中心新增 FROGGER 復古像素風閃避遊戲：13 列 × 11 欄的固定視角道路／河流分格地圖，玩家以方向鍵離散跳格前進，穿越 5 條車道閃避連續平移的車輛、再穿越 5 條河道踩踏漂浮平台渡河，最終跳進終點列的 5 個蓮花座視為完成一輪；掉入水中或撞車扣 1 條 Life，Life 歸零 Game Over，每完成一輪車輛/平台速度與密度提升一級。規則核心抽成 `app/utils/froggerEngine.ts`（比照 battleshipEngine.ts／solitaireEngine.ts 先例），比照既有 16 款遊戲的架構擴充。全部使用原創 Pixel 角色與障礙物，不取用 Frogger 官方美術／Logo。本次是架構規劃階段，僅產出 OpenSpec 提案文件，尚未實作程式碼。
