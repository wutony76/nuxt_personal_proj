# add-flappy-game

遊戲中心新增第 18 款復古像素風小遊戲 **FLAPPY**：玩家控制原創 Pixel 角色持續受重力下墜，點擊／Space／Touch 給予向上衝力，自動向右捲動穿越成對管道（上下兩段障礙＋中間 gap），每通過一組管道 +1 分，撞到管道或地面即 Game Over。玩法比照 `runner.vue` 的「重力＋跳躍＋自動捲軸」既有先例延伸，但改為連續垂直物理（無地面站立、可撞頂/撞底）＋成對管道資料結構，是本次架構新增的部分；規則核心抽成不依賴 Vue 的 `app/utils/flappyEngine.ts`。渲染沿用專案既有 DOM/CSS 慣例（非 Canvas），主題色採 `#06d6a0`（青綠色）。本文件為第一階段規劃（proposal → design → tasks），尚未進入實作。
