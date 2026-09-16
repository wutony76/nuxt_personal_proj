## 1. 已確認，可以實作

- [x] 1.1 繼續抽：不加注、共用彩池連乘、抽空歸零、上限 `bet * 500`
- [x] 1.2 沒有新幣別。使用帳號 F 幣。toys 彩池 8 款共用一份
- [x] 1.3 不改 `AppTopbar.vue`、不加 `/toy-hall`

## 2. 服務與 API

- [x] 2.1 新增 `server/services/game/toys/catalog.ts`：8 款目錄、籌碼、抽抽樂基點表、動畫毫秒、`maxPotMultiplier: 500`
- [x] 2.2 新增 `pool.ts`：一份共用彩池，記下使用者未領金額、來源遊戲、注額
- [x] 2.3 新增 `random.ts`、`reward.ts`、`luckyDraw.ts`。公式不 import 彩票 class
- [x] 2.4 `walletBalance.ts` 只加 `toy-bet`、`toy-reward`。扣款與入帳走 `appendChange`
- [x] 2.5 新增 `catalog.get.ts` 與 `lucky-draw/roll.post.ts`。未登入不可開局

## 3. 錢包與局狀態

- [x] 3.1 Header 顯示既有帳號 F 幣。結算後重新讀同一顆餘額。不新增幣別、不新增錢包 composable
- [x] 3.2 新增 `useToyRound.ts`：`idle` / `playing` / `result`、`settling` 鎖。未領金額以伺服器彩池為準

## 4. 柑仔店櫥仔

- [x] 4.1 在 `lottery-hall-taiwan.vue` 的玩法貨架與頁尾之間插入 `#tw-shelf`
- [x] 4.2 標題「柑仔店櫥仔」、副標「懷舊零嘴 · 古早玩具」、8 張圓章卡，沿用 `.theme-taiwan-lottery` token
- [x] 4.3 只有抽抽樂連到 `/toys/lucky-draw`；其餘不可導航。櫥仔失敗不得清掉彩票卡
- [x] 4.4 不做設計稿的三張照片位，不改既有彩票卡

## 5. 抽抽樂頁

- [x] 5.1 新增 `app/pages/toys/lucky-draw.vue` 與 `app/components/toys/` 的 Header、下注、結果、彩池、按鈕
- [x] 5.2 Header 的「轉去大廳」回到 `/lottery-hall-taiwan#tw-shelf`，並顯示帳號 F 幣
- [x] 5.3 選格後只播服務回傳的結果。翻牌不再隨機。連點與重複領取被擋住
- [x] 5.4 版面不寫死機率與倍率，讀 catalog API

## 6. 測試

- [x] 6.1 新增 `scripts/test-toy-lucky-draw.mjs` 與 `package.json` 的 `test:toy-lucky-draw`，直接 import service
- [x] 6.2 測試覆蓋：注額、扣款、獎勵、空獎、繼續連乘、爆掉歸零、注入 RNG、權重和 10000。平手與連勝註明不適用
- [x] 6.3 確認未修改 `gameSlugs.js`、`AppTopbar.vue`、`/game-hall`，且 `walletBalance.ts` 只加了兩種異動類型

## 7. 紙牌

- [x] 7.1 新增 `/toys/cards` 與 `cards.ts`。牌面 1–13、不放回、發完重洗
- [x] 7.2 大／小走連勝表，相同固定 ×10 並計入連勝。猜錯歸零。第 5 勝只能領
- [x] 7.3 補 `scripts/test-toy-cards.mjs`

## 8. 汽水笛

- [x] 8.1 新增 `/toys/soda-whistle`。獎金以注額 100 的示意表換算：`round(bet * 表定金額 / 100)`
- [x] 8.2 爆掉機率 2%、4%、7%、12%、20%、30%。爆掉歸零。第 6 次成功只能領
- [x] 8.3 補 `scripts/test-toy-soda-whistle.mjs`

## 9. 竹蜻蜓

- [ ] 9.1 新增 `/toys/bamboo-copter`。先抽高度，動畫播放同一個值
- [ ] 9.2 達標才入帳，未達標不加帳。同一請求結清，不留未領金額
- [ ] 9.3 補 `scripts/test-toy-bamboo-copter.mjs`

## 10. 橡皮糖

- [ ] 10.1 新增 `/toys/gummy`。四色各 25%，顯示最近四顆真實顏色
- [ ] 10.2 猜中走連勝表，猜錯歸零。第 5 勝只能領
- [ ] 10.3 補 `scripts/test-toy-gummy.mjs`

## 11. 大豬公

- [ ] 11.1 新增 `/toys/big-pig`。四顆骰先決定再播動畫
- [ ] 11.2 和局退注。玩家勝才套金豬 ×5、雙豬 ×2.5、一般 ×1.9。小豬 ×0 不退注
- [ ] 11.3 補 `scripts/test-toy-big-pig.mjs`

## 12. 哨子糖

- [ ] 12.1 新增 `/toys/whistle-candy`。短勝長、長勝中、中勝短。倒數不重抽
- [ ] 12.2 勝 ×1.9，相同退注。NPC 最近 8 次是實際抽出的選擇
- [ ] 12.3 補 `scripts/test-toy-whistle-candy.mjs`

## 13. 尪仔標

- [ ] 13.1 新增 `/toys/pog`。12 張牌各發 5 張，打滿五回合後一次結清
- [ ] 13.2 贏的回合多 ×1.9，平手退注。王再 ×2 一次，盾抵一次失敗，換可重抽，炸讓 NPC 下一張 -2
- [ ] 13.3 補 `scripts/test-toy-pog.mjs`
