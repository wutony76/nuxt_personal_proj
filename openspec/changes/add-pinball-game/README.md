# add-pinball-game

遊戲中心新增 **PINBALL**：像素風彈珠台 + Roguelite。禁止 Canvas／WebGL，全部以 DOM + CSS transform 呈現；固定 360×640 虛擬座標系配合外層 `ResizeObserver` 等比例縮放，確保物理手感不因裝置尺寸而改變。核心玩法：雙 Flipper（角度插值擺動＋撞擊點/角速度反饋）、3 個 Bumper、4 個 Target（全亮觸發 Fever）、1 個高風險 Golden Hole、Combo 倍率、3 顆球一輪、掉球後 3 選 1 隨機 Upgrade（12 項，集中管理）。與其餘 26 款遊戲共用 `useGameHistory`／server coin 結算架構，主題色 `#00f5d4`，game-hall 入口登記為 `id: 26`、路徑 `/game/pinball`。

使用者已明確授權「先建 spec、之後直接開始實作，方向錯了之後再調整」，本提案文件完成後立即依 `tasks.md` 執行實作，不採用其餘 `add-*-game` 提案「僅產出文件、等待核准」的流程。
