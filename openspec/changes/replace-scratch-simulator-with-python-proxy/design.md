# Design

## 發現既有 API：`admin_site/api_views.py`

`py3_AVScratch_proj` 專案裡其實已經有一支 Django REST API（在開始移植
model02 之後才被使用者提及），定義在 `admin_site/api_views.py`：

```
GET /api/scratch/<model_id>?coin=<金額>&count=<張數>&image=<0|1>
```

```json
{
  "model": "01",
  "coin": 1000,
  "count": 1,
  "results": [
    {
      "win_coin": 1000,
      "play_one": { ... },
      "play_two": { ... },
      "play_three": { ... },
      "b64card": "data:image/jpeg;base64,..."
    }
  ]
}
```

行為重點（逐一實測確認）：

- `model_id` 必須是 `01`~`09`，否則回 400
- `coin` 必須在該 model 的 `card_win_coins` 清單內，否則回 400 並附上
  `valid_coins` 清單
- `count` 內部用 `min(count, 50)` 再 `max(count, 1)` 夾擠，跟先前
  model02/03 自己實作的夾擠邏輯語意一致
- `image=0` 可以關掉圖片（省頻寬），預設 `image=1` 含圖
- **model07 是特例**：`analyze_card()` 只回傳 2 個值（沒有
  `b64card`），對應原本背景 agent 調查到的「model07 無卡片素材」——
  這支 API 自己就知道，回應裡單純不含 `b64card` 欄位，前端只要判斷
  欄位是否存在即可，不需要自己維護「哪些 model 有素材」的清單
- 另有 `GET /api/scratch/info`：列出全部 9 個 model 的名稱
  （`MODEL_NAMES`，例如 01 是「十二生肖」、07 是「點十成黃金」，其餘
  目前還是預設的「Model 0X」佔位名稱）與各自的 `valid_coins`，前端可以
  完全動態組出 model 選單與金額選單，不用寫死任何清單

## Nuxt 端：薄代理層

兩支新 API，都只做「驗證管理員身份 → 轉發 → 把錯誤轉成前端看得懂的
格式」，不碰任何業務邏輯：

- `scratch-info.get.ts`：轉發 `GET {base}/api/scratch/info`
- `scratch.get.ts`：轉發 `GET {base}/api/scratch/<model>?coin=&count=&
  image=1`，把 Python 服務的 400/404 錯誤內容（`{"error": "..."}`）
  轉成 Nuxt 的 `createError`，連線失敗（服務沒開）回 502 並附上目前
  連的是哪個網址，方便除錯

`base` 來源：`process.env.SCRATCH_PY_API_BASE || 'http://127.0.0.1:8000'`
——沿用這個專案既有的 `process.env.X || 預設值` 慣例（例如
`server/services/test.ts` 的 `PORT`），不特地加 `runtimeConfig`（專案
目前完全沒有用這個機制，沒必要為了這一個外部依賴新增一套設定模式）。

## 前端：單一通用畫面取代逐 model 客製表單

`app/pages/admin/game-simulator.vue` 從「tabs 切換 model02/model03、
各自獨立表單與卡片元件」簡化成：

1. 進頁面先呼叫 `scratch-info`，動態組出 9 個 model 的 tab（文字直接用
   API 回傳的 `name`，例如「Model01 · 十二生肖」），切換 tab 會連動
   更新目標金額下拉選單的選項（各 model 的 `valid_coins` 不同）
2. 按「隨機試算」呼叫 `scratch`，每張卡顯示：
   - `win_coin`（得獎金額）
   - `b64card`（有的話）：直接當 `<img :src="...">`，不用自己疊圖、
     不用自己管理素材資源，Python 服務已經用原始系統的渲染邏輯產出
     正式畫面等級的圖
   - 沒有 `b64card`（目前只有 model07）：顯示「此 model 無卡片圖素材
     （原始系統本來就沒有）」提示文字，不報錯
   - `play_one`/`play_two`/`play_three`：格式化 JSON 放進
     `<details>`（預設收合，避免每張卡一展開就是一大片原始資料擠滿
     畫面），給需要核對數字細節的情境用

### 為什麼不逐 model 刻版面

model02/03 的經驗證明，逐 model 手動對齊卡片視覺的成本很高（model03
甚至要動用 OpenCV 精確量測才收斂到 0px 誤差），而且每個 model 的
`play_one`/`play_two`/`play_three` 內部形狀完全不同（猜拳用
`{title, color, play, coin, get_coin}` 陣列；model02 用
`{enemy_card, my_card}`；model07 用巢狀陣列
`{title, color, play: [], coin: [14, 10000], get_coin}`...），要幫
9 個 model 各自刻一份有意義的結構化呈現，工作量跟先前移植機率表的
工作量相當，而且**這支 API 已經提供了「正確答案」級別的卡片圖**，
沒有必要重新發明一次視覺呈現。格式化 JSON 雖然不美觀，但對「機率/
派彩驗證」這個核心用途（核對數字是否正確）完全足夠，且不會像手刻
版面一樣引入新的對齊誤差風險。

## 清除舊實作

先前兩個 change（`add-scratch-model02-simulator`／
`add-scratch-model03-simulator`）移植的機率表、消費邏輯、卡片視覺元件、
素材資料夾、專屬測試腳本，全數刪除（見 `tasks.md` 的刪除清單）。這些
change 文件本身保留在 `openspec/changes/` 底下當歷史紀錄（已加註取代
說明），不刪除——它們完整記錄了「為什麼一開始決定自己移植」「移植過程
踩過的坑」，即使最後的實作被取代，這些紀錄本身仍有參考價值（例如
OpenCV 精確量測這個手法，未來若真的需要自己刻視覺呈現時還用得上）。

## 已知限制

- 這支工具現在**完全依賴使用者本機的 Python 服務是否有在跑**，不是
  Nuxt 專案自帶的能力。`/admin/game-simulator` 的定位本來就是內部
  管理員試算驗證工具，接受這個限制；若未來要讓其他開發者或 CI 環境
  也能完整驗證，需要另外討論是否要把 Python 服務一起容器化或提供
  替代的本地假資料模式——這次不處理
- model01~09 除了 01（十二生肖）、07（點十成黃金）有正式名稱，其餘
  7 個目前 Python API 回傳的名稱都還是預留的「Model 0X」佔位字串，
  這是 Python 專案本身 `MODEL_NAMES` 字典還沒填完整，不是這次 Nuxt
  端的問題
