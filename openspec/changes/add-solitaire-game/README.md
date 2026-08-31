# add-solitaire-game

遊戲中心新增 SOLITAIRE 傳統接龍（Windows XP 經典 Klondike）：52 張標準撲克牌、7 欄 Tableau、Stock/Waste（Draw 1）、4 個 Foundation，支援點擊選取操作、自動翻牌、雙擊自動上疊、勝負判定，比照既有十一款遊戲的架構擴充；規則核心抽成 `app/utils/solitaireEngine.ts`（比照 match3Engine.ts 先例），牌面渲染新增 `PlayingCard.vue` 共用元件。
