# Design

## 資料來源：`.pkl` → TypeScript 常數

`py3_AVScratch_proj/data/model02.pkl` 解開後確認零 BTrees（跟 model03 一樣
是純 `dict`/`tuple`/`list`/`int`），逐筆核對後原封不動抄進
`server/services/game/scratch/model02Data.ts`：

- `CARD_WIN_COINS`：9 檔目標金額（0、300、500、1000、1500、4500、15000、
  100000、3000000）
- `PLAY1_WIN_COINS`／`PLAY2_WIN_COINS`／`PLAY3_WIN_COINS`：三段分數各自
  的面額清單（`PLAY2_WIN_COINS` 不含 0）
- `PLAY1_WIN_COINS_COMB`／`PLAY2_WIN_COINS_COMB`／`PLAY3_WIN_COINS_COMB`：
  每檔分數底下所有可能的面額組合
- `WIN_COINS_COMB`：每檔目標金額底下所有「play1 分數＋play2 分數＋play3
  分數＝目標金額」的三元組組合

## 消費邏輯：忠實移植 `get_coin_card()`／`get_play1()`／`analyze_card()`

### 抽卡（`_getCoinCard`）

1. 驗證目標金額在 `CARD_WIN_COINS` 內
2. 從 `WIN_COINS_COMB[目標金額]` 隨機抽一組 `[p1Target, p2Target,
   p3Target]`
3. `play3` = 洗牌 `PLAY3_WIN_COINS_COMB[p3Target]` 隨機抽到的一組 5 格
   面額
4. `play2Combo` = `p2Target === 0` 時為空陣列（沒有紅包）；否則從
   `PLAY2_WIN_COINS_COMB[p2Target]` 隨機抽一組
5. `play1Combo` = 從 `PLAY1_WIN_COINS_COMB[p1Target]` 隨機抽一組
6. 呼叫 `_getPlay1(play1Combo, play2Combo)` 組出幸運號碼配對＋紅包加碼
   的完整 10 格

### 幸運號碼配對＋紅包加碼（`_getPlay1`）

1. 15~60（46 個數字）洗牌後取前 3 個當「幸運號碼」（`luckNumbers`）
2. 計算跟幸運號碼「差 1」的號碼（near-miss）：排除範圍外、排除本身已是
   幸運號碼的情況——`pickOtherNumArr`
3. `otherNumArr` = 46 個數字扣掉幸運號碼、扣掉 near-miss 號碼（這個扣除
   讓中獎判定可以直接用 `luckSet.has(num)`，不需要另外維護一份
   `winCells` 清單——裝飾格與中獎格的候選池由建構方式保證互斥）
4. `play1Combo` 裡非 0 的面額個數＝這張卡「幸運號碼配對」中幾格；從
   3 個幸運號碼裡抽對應個數出來配對這些面額（`playerWCoinNum`）
5. 剩餘格數（10 減掉 near-miss 格數、減掉配對中獎格數）從
   `otherNumArr` 隨機抽出來，各自配一個從 `PLAY2_WIN_COINS` 隨機挑的
   「裝飾用」金額（`playerCoinNum`）；near-miss 號碼也配一個裝飾金額
   一起併入
6. 對 `play2Combo` 裡的每個紅包面額：從 `playerCoinNum` 隨機移除一格，
   換成 `[100, 紅包面額]`（100 是紅包的專用代碼）
7. 最終 10 格洗牌（`playerCoinNum` ＋ `playerWCoinNum`）

### 中獎判定簡化（`analyzeModel02Card`）

一開始的草稿仿照 model03 維護一份 `winCells` 清單核對中獎，後來發現
多餘：裝飾格的候選池（`otherNumArr`）在 `_getPlay1` 建構時就已經排除了
3 個幸運號碼本身，所以只要格子顯示的數字出現在 `luckNumbers` 裡，必然
是「幸運號碼配對」中獎格，不會有「長得像中獎但其實沒中」的號碼——拿掉
`winCells` 這層，直接用 `luckSet.has(num)` 判斷，程式更簡單也不會引入
額外的一致性風險。

```ts
if (num === 100) return { label: '紅包', color: 'red', isWin: true }
const isWin = luckSet.has(num)
return { label: String(num), color: isWin ? 'yellow' : 'black', isWin }
```

### 兩個容易誤解、但忠實保留的既有設計

1. **裝飾格的金額是純展示值**：`playerCoinNum` 的金額來自
   `random.choice(PLAY2_WIN_COINS)`（逐行比對 `scratch_model02.py` 的
   `get_play1()` 確認），跟這格是否中獎完全無關——玩家刮開沒中獎的格子
   一樣會看到一個隨機金額，但那不是真的能拿到的錢
2. **near-miss 號碼刻意展示**：跟幸運號碼差 1 的號碼會被排除在裝飾池
   候選之外（`pickOtherNumArr`），但不排除在「顯示」之外——這些號碼
   一樣會出現在卡片上，製造「差一點就中」的視覺效果，但不會中獎

## 卡片視覺還原：沿用原始座標，明確標註範圍限制

跟 model03 不同，model02 的底圖（`AV_model02_2.jpg`）是一整片沒有分格
標記的紅包形狀剪影（重複的「ACE KING」佔位材質），**沒有印刷格線或
圓圈這類可以拿來核對座標的地標**，所以不像 model03 能用 OpenCV Hough
circle transform 量出「正確答案」。

做法：

- 版面座標直接沿用原始碼 `get_scratch_card.py` 的 `get_model02_plist()`，
  逐行比對確認座標起點與增量完全一致（3 個幸運號碼 `(250,80)` 起 x+50；
  10 個號碼格 `(230,120)` 起，4 欄網格，欄距 70、列距 55；play3 5 格
  `cx=70,cy=240`，特殊的分段增量 `+50,+50,+50,+300,+50`）
- 沿用 model03 的教訓：座標全部換算成佔容器寬高的百分比（不是寫死
  px），避免容器響應式縮放時跑位，這次直接套用、不用再走一次「寫死
  px → 發現縮放跑位 → 改百分比」的回頭路
- 素材用跟 model03 同一套一次性腳本（這次寫成通用版本，支援
  `textureRotated` 的材質切圖，雖然 model02 用不到），依
  `av02_texture.plist` 切出 58 張獨立小圖（46 個號碼 15~60、9 種金額
  文字、1 個中獎紅圈、1 個紅包圖示），存進
  `public/images/scratch/model02/`

### 已知視覺小瑕疵：裝飾用大面額數字會跟相鄰格重疊

Playwright 截圖驗證時發現：10 格裡的裝飾用金額若抽到 3,000,000（對應
素材 `coin_3000000.png` 寬達 106px），會跟只有 70px 欄距的相鄰格文字
重疊。逐行比對 `get_model02_plist()` 確認座標公式完全一致，這個重疊
是原始設計本身在遇到大面額裝飾數字時就會有的視覺瑕疵，不是這次移植
造成的座標計算錯誤。

跟使用者確認處理方式，使用者選擇**忠實保留、照原樣**（備選方案是縮小
裝飾金額字體/限制裝飾金額候選範圍，但兩者都會偏離原始行為，使用者
認為不需要）。卡片視覺下方保留純文字版的號碼格/play3 明細表格，供需要
精確核對數字的情境使用，不受視覺重疊影響。

## 頁面結構調整：單一 model 畫面 → model02／model03 tabs

`app/pages/admin/game-simulator.vue` 原本是只支援 model03 的單一畫面
（`WIN_COIN_OPTIONS` 寫死 model03 的 11 檔金額、規則說明文字針對猜拳
設計）。本次改成：

- 新增 `MODEL_TABS` 常數＋ `state.activeModel` 控制目前檢視的 model
- 每個 model 各自獨立的 `state.model02`／`state.model03` 狀態（各自的
  `cardWinCoin`／`count`／`cards`／`status`），互不影響、切換分頁不會
  清空另一個分頁已經試算好的結果
- 目標金額下拉選單依目前分頁切換選項清單（model02 是 9 檔、model03
  是既有的 11 檔）
- 規則說明文字／已知設計細節揭露面板依分頁個別呈現

Playwright 驗證：切換到 model03 分頁試算，行為與改版前一致，確認
重構沒有動到 model03 既有邏輯。

## 範圍邊界：不做其餘 7 個 model

model07 完全沒有卡片素材（資料夾不存在），model01/05 底層資料是巢狀
`BTrees.OOBTree`、各自融合 3 個子遊戲，複雜度最高——留待之後使用者視
需要再一款一款評估是否要做。
