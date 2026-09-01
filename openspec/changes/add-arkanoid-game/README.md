# add-arkanoid-game

遊戲中心新增 **ARKANOID** 復古像素風打磚塊遊戲，明確定位為現有 **BREAKOUT** 的進階版本，而非另一份幾乎相同玩法的複製品：在 BREAKOUT 既有的 Paddle／Ball／Brick／清關／Lives 骨架之上，疊加 Multi-Hit Brick（多次命中磚塊）、Moving Brick（移動磚塊）、Power-Up（WIDE／MULTI_BALL／SLOW，先做 3 種，FIRE 留待下一版）、Multi Ball（單球陣列化）與 Combo 計分。本次僅產出 OpenSpec 提案文件，**不撰寫任何程式碼、不修改 `app/pages/game/breakout.vue` 或任何既有檔案**；design.md 針對「共用模組 vs 獨立實作」提出方案並列入 Open Questions，交由使用者決定是否要對 BREAKOUT 進行抽出共用 engine 的重構。遊戲主題色採 `#ef476f`（玫瑰紅），game-hall 入口登記為 `id: 24`、路徑 `/game/arkanoid`。
