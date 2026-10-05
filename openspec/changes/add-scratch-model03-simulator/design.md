# Design

## 資料來源：`.pkl` → TypeScript 常數

`py3_AVScratch_proj/data/model03.pkl` 解開後是一個 `(dict, dict)` 的
tuple：

- `play1_play_res_comb`：key 是局面狀態（100 輸／101 贏／102 平手），value
  是這個狀態底下所有可能的 `(我的手勢, 對手手勢)` 組合（0=剪刀/1=石頭/2=布）
- `model03_win_coins_comb`：key 是這張卡的目標中獎金額（11 檔：0、100、
  200、300、500、800、1500、5000、10000、60000、600000），value 是所有
  「5 個面額加總＝這個目標金額」的組合

用一支一次性 Python 腳本（`pickle.load()` + 字串化 key）把這兩個 dict
轉成 JSON，確認型別全是 plain int/tuple/list（沒有 BTrees 或任何自訂
類別），逐筆核對過內容後，原封不動抄進
`server/services/game/scratch/model03Data.ts` 當作具名匯出的 TypeScript
常數（型別化成 `HandCombo`／`CoinCombo`），不是執行期才載入的 JSON 檔——
資料量很小（轉出來的 JSON 只有 1.3KB），用具名 TS 常數比額外引入 JSON
import 機制簡單，也跟這個專案其他遊戲設定檔（例如
`shared/config/bingo.ts`）的既有慣例一致。

## 消費邏輯：忠實移植 `get_coin_card()`／`get_play1()`／`analyze_card()`

### 抽卡（`_getCoinCard`）

1. 驗證目標金額在支援清單內
2. 從 `WIN_COINS_COMB[目標金額]` 隨機抽一組 5 位數的面額組合

### 單局判定（`_getPlay1`）

對抽到的 5 個面額（先洗牌，對應 Python `random.shuffle`），逐一判定：

- 面額 > 0：
  - 面額屬於 `FORCED_WIN_COINS`（200/300/500/800/1500/5000/10000/60000/
    600000 這些較高面額）→ 強制判定為「贏」（state 101）
  - 面額剛好是 100（清單裡最小的非零面額）→ 真的走隨機：60% 贏
    （101）、40% 平手（102）
- 面額 = 0：判定為「輸」（state 100）

判定出 state 後，從該 state 對應的手勢組合池（`PLAY1_PLAY_RES_COMB`）
「洗牌後 pop，池子空了才重新洗牌補滿」地抽一組實際手勢——這個池子是
**模組層級的共用狀態**（`_rotatingHandPool`），會跨越多次 API 呼叫持續
消耗/補充，不是每次呼叫都重置，忠實對應 Python 版 process-wide 單例
（`Model03Inst.get_inst()`）的 `self.copy_play1_play_res_comb` 行為。

這局最終顯示的「面額」（`coin`）依 state 而定：

- 101（贏）：就是原始面額本身
- 102（平手）：原始面額 **乘以 2**（這是忠實移植的一個容易被忽略的細節：
  平手局顯示的面額會比原始抽到的面額大一倍）
- 100（輸）：從 `PLAY1_WIN_COINS` 隨機挑一個面額純粹拿來顯示，不影響
  「得到金額」（反正輸的局「得到金額」一定是 0）

### 「得到金額」的既有落差（`analyze_card` 的 `getCoin`）

```ts
const getCoin = myHand === enemyHand ? round.coin / 2 : 0
```

只檢查「實際抽到的兩個手勢是否完全相同」，不是檢查「這局原本判定的
state 是不是贏/平手」。因為猜拳規則下「贏」的手勢組合（`[0,2]`／`[1,0]`／
`[2,1]`）必然兩個手勢不同，只有「平手」的手勢組合（`[0,0]`／`[1,1]`／
`[2,2]`）才會相同——所以這行程式碼實際上**只對 state=102（平手）的局
產生非零值**，state=101（贏）的局，不管顯示文字再怎麼標紅（`color`
欄位，代表「這局原本判定為贏或平手」），`getCoin` 永遠是 0。

這跟頁面規則文字「猜拳贏得獎金、平手得一半」不一致，是原始 Python 系統
本來就有的落差（見 `proposal.md`「背景」一節），已跟使用者確認忠實移植、
不擅自修正，在這裡與 `model03.ts` 檔頭都留了清楚註解。

## 卡片視覺還原（追加）

第一版刻意不搬圖片渲染，但使用者實際使用後回報「目前有資料但是沒有
全部還原與卡片融合的樣子」——純文字表格不夠，想看到跟原始系統一樣、
手勢/金額疊在底圖卡片上的畫面。追加實作：

- 原始 Python 版用 PIL 把素材畫進一張 JPG、編碼成 base64 字串回傳給
  前端；Web 前端其實不需要在後端重畫一張圖，**直接用 HTML/CSS 疊圖**
  即可達到同樣的視覺效果，不用額外引入 canvas/影像處理套件
- 素材來源：`py3_AVScratch_proj/scratch/Scratch/model03/` 底下的
  `AV_model03_2.jpg`（底圖）與 `av03_texture.png`（材質圖集，TexturePacker
  格式，搭配 `av03_texture.plist` 記錄每個命名方塊在圖集裡的像素座標）。
  寫一次性 Python 腳本依 `.plist` 的矩形座標切出 15 張獨立透明 PNG
  （11 種金額文字圖示、3 種猜拳手勢圖示、1 個中獎紅圈），存進
  `public/images/scratch/model03/`，不是執行期才切圖
- 版面座標參考原始碼 `get_scratch_card.py` 的 `get_model03_plist()`：底圖
  600×384px，5 局的手勢圖示沿對角線排列、每局往右下偏移。原始碼寫的
  偏移量是 `cx += 35, cy += 65`，但使用者實機比對後回報「回合數的猜拳
  結果與金額有點跑位」，改成 `ROUND_STEP_LEFT = 45`／`ROUND_STEP_TOP = 60`
  才跟這份底圖素材上事先印好的 5 組圈圈位置真正對齊；中獎的局額外疊
  一個紅圈
- 唯一調整：原始碼的「目標金額」大徽章位置是 `(450-100, -30)`，Y 座標
  是負值，實際疊圖時會被裁掉大半，幾乎看不到——這是純版面瑕疵，不是
  機率/派彩邏輯，改放到卡片右上角一個有白底的徽章內，確保清楚可見
- 新增 `app/components/admin/ScratchModel03Card.vue`：純展示用元件，吃
  `ScratchModel03Card`（API 回傳的單張卡資料，型別已擴充 `handValues`
  讓前端能選對應的手勢圖示），不碰任何機率/派彩邏輯；純文字版的回合
  明細表格保留在卡片視覺下方，給需要精確核對數字的情境用

## 範圍邊界：不做其餘 8 個 model

其餘 8 個 model（01/02 規則比 03 複雜，04~09 底層資料是
`BTrees.OOBTree`）留待之後視需要再評估是否要做、要做幾個——本次只先做
model03 當作驗證「`.pkl` → JSON 資料 → TS 消費邏輯 → 卡片視覺還原」整條
pipeline 走不走得通的範本。

其餘 8 個 model（01/02 規則比 03 複雜，04~09 底層資料是 `BTrees.OOBTree`）
留待之後視需要再評估是否要做、要做幾個——本次只先做 model03 當作驗證
「`.pkl` → JSON → TS 消費邏輯 → 後台試算頁」這整條 pipeline 走不走得通的
範本。
