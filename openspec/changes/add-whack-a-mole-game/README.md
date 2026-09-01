# add-whack-a-mole-game

遊戲中心新增 WHACK-A-MOLE 復古像素風打地鼠反應遊戲：3×3 洞穴格（比照 MINESWEEPER 的 `flatCells` + Grid 渲染模式）、地鼠隨機出現於空洞穴、玩家點擊／觸控擊中得分並累積 Combo 倍率（沿用 `typing.vue` 的 `calcMultiplier` 分段模式）、獨立的 Spawn Timer 與 Lifetime Timer（比照 `runner.vue` 的定時＋隨機生成先例），且 Lifetime 隨遊戲時間增加逐漸縮短以提升難度、60 秒倒數計時、Game Over 與 Restart、Pause。規則核心抽成 `app/utils/whackAMoleEngine.ts`。特殊地鼠（金地鼠加倍分／炸彈地鼠扣分）留待下一個變更。本次不影響既有 20 款遊戲。
