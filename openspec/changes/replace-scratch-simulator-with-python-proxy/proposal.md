# Proposal

## 變更名稱

replace-scratch-simulator-with-python-proxy — 刮刮樂試算工具改成直接轉
呼叫本機 Python 服務，取代逐個 model 手動移植機率表/消費邏輯/卡片視覺
的做法

## 背景

**本次變更取代、廢止先前的 `add-scratch-model03-simulator` 與
`add-scratch-model02-simulator` 兩個 change。** 這兩個 change 當初決定
「在 Nuxt 內用 TypeScript 重新實作機率消費邏輯，不跑獨立 Python
server」，並依此做法完整完成了 model03（剪刀石頭布）與 model02（紅包
任你刮）：各自的機率表轉出成 TS 常數、消費邏輯逐行移植、卡片視覺用
HTML/CSS 疊圖還原（素材切圖＋座標比對）。

過程中發現一個改變處境的事實：使用者原始 Python 專案
`py3_AVScratch_proj` 其實已經有一支**現成的 REST API**
（`admin_site/api_views.py` 的 `/api/scratch/<model_id>`），直接呼叫
`inst.analyze_card(coin)` 回傳機率試算結果，**連 PIL 畫好的卡片圖都用
base64 一起回傳**，涵蓋全部 9 個 model（01~09），且使用者會長期在本機
跑著這支服務。

跟使用者確認後，決定**整個刮刮樂試算工具改成直接轉呼叫這支既有 API**，
不再維護任何一個 model 的機率表、消費邏輯、或卡片素材——包含已經做完的
model02/model03 也一併改掉。原因：

- 原本的「移植機率表＋重寫消費邏輯＋手動疊圖」做法，光是 model02/03
  兩個就耗費大量心力在卡片視覺對齊上（model03 甚至動用 OpenCV 精確
  量測才收斂），而這支既有 API 已經用原始系統本身的渲染邏輯產出
  「正確答案」級別的卡片圖，不需要再自己還原一次
- 剩餘 7 個 model（01、04~09）不用再一個一個移植機率表／消費邏輯，
  直接就能用，包含原本調查認定「無素材」的 model07（實際上這支 API
  本身就知道 model07 沒有卡片圖，回應裡單純不含 `b64card` 欄位，不是
  要我們自己去找素材）
- 金額合法性檢查、張數夾擠（上限 50）這些既有做法要注意的細節，這支
  API 自己也都做了，不用在 Nuxt 端重複實作一次

## 目標

- `/admin/game-simulator` 改成單一通用畫面：model 下拉選單（9 個，
  名稱與支援金額皆從 API 動態取得）、目標金額、模擬張數，顯示每張卡的
  原始渲染圖（`b64card`，有的話）＋原始資料（`play_one`/`play_two`/
  `play_three`，格式化 JSON 呈現，不逐 model 刻版面）
- Nuxt 後端只負責驗證管理員身份、轉發請求、把連線失敗/驗證錯誤轉成
  前端看得懂的訊息，不維護任何機率表或消費邏輯
- 刪除 model02/model03 既有的機率表／消費邏輯／卡片視覺元件／素材
  資料夾／專屬測試（已被這次的通用做法取代）

## 範圍

- 包含：
  - `server/api/admin/game-simulator/scratch-info.get.ts`（轉發
    `/api/scratch/info`，列出 9 個 model 名稱／支援金額）
  - `server/api/admin/game-simulator/scratch.get.ts`（轉發
    `/api/scratch/<model>?coin=&count=&image=1`）
  - `app/pages/admin/game-simulator.vue`（改寫成通用畫面）
  - `app/services/api.ts`（移除 model02/03 專屬型別與呼叫，新增通用的
    `ScratchSimResponse`／`ScratchInfoResponse` 型別與
    `scratchInfo()`／`scratch()` 呼叫）
  - `test/test-scratch-sim.mjs`（通用測試，取代
    `test-scratch-model02.mjs`／`test-scratch-model03.mjs`）
  - 刪除：`server/services/game/scratch/`（model02/03 的資料與消費邏輯
    檔案）、`server/api/admin/game-simulator/scratch-model02.post.ts`／
    `scratch-model03.post.ts`、`app/components/admin/
    ScratchModel02Card.vue`／`ScratchModel03Card.vue`、
    `public/images/scratch/`（model02/03 素材資料夾）
- 不包含：
  - 不改動 Python 服務本身（`py3_AVScratch_proj`），純粹當成既有服務
    呼叫
  - 不處理 Python 服務的部署/正式環境問題——這支服務目前只是使用者
    本機長期在跑的開發用服務，`/admin/game-simulator` 本來就是內部
    管理員用的試算工具，不是玩家會用到的正式功能

## 影響面

- 後端 API/Services：移除 `server/services/game/scratch/` 整個目錄、
  新增兩支薄代理 API
- 前端路由/頁面：`app/pages/admin/game-simulator.vue` 從「單一 model
  專屬表單」改寫成「通用 model 切換＋通用資料呈現」
- 外部依賴（新增）：**執行期依賴使用者本機的 Python 服務**
  （`SCRATCH_PY_API_BASE`，預設 `http://127.0.0.1:8000`）——這是本次
  變更引入的新風險，見下方「風險與對策」

## 風險與對策

- 外部依賴風險：
  - 風險：這支工具現在的運作**依賴一個 Nuxt 專案之外、使用者自己手動
    維護的 Python 服務**是否有在跑。如果服務沒開，`/admin/
    game-simulator` 整頁都無法試算；其他開發者或 CI 環境如果沒有這支
    服務，相關測試也無法驗證完整行為
  - 對策：
    - 代理 API 連線失敗時回傳清楚的 502 錯誤訊息（告知是哪個網址連不
      到），不是曖昧的 500
    - `test-scratch-sim.mjs` 偵測不到服務時**直接略過（exit 0）**，
      不當成 CI 失敗，避免因為這個可選的外部依賴讓其他人的測試環境
      誤判成回歸
    - 這個風險被接受的前提：`/admin/game-simulator` 本來就是內部管理
      員用的試算驗證工具，不是玩家會用到的正式功能，使用者明確說明
      這支服務是他自己長期在跑的本機開發用服務
- 技術風險：
  - 風險：model01~09 的 `play_one`/`play_two`/`play_three` 形狀因玩法
    不同而異（猜拳、撲克牌、號碼配對...），不可能用同一套版面精確
    呈現每個 model 的細節
  - 對策：確認「機率/派彩驗證」這個核心用途不需要逐 model 客製版面——
    卡片圖（`b64card`）已經是正式系統的渲染結果，原始資料用格式化
    JSON 呈現即可讓人核對數字，跟使用者確認這個做法可接受
- 範疇風險：
  - 風險：先前兩個 change（model02/model03）投入的移植/視覺對齊工作
    成果被整個丟棄
  - 對策：跟使用者明確確認「全部改成呼叫這支 API（含已完成的
    model02/model03）」才動手；兩份舊 change 文件保留在
    `openspec/changes/` 底下當歷史紀錄，加註已被本次變更取代，不刪除

## 驗證方式

- 功能驗證：
  - `GET /api/admin/game-simulator/scratch-info` 回傳 9 個 model 名稱與
    支援金額清單
  - 不合法 model／金額皆正確回 400，張數夾擠正確（Python 服務本身的
    行為，透過代理驗證端到端沒有被破壞）
  - model02 正常試算：5 張卡皆有 `win_coin` 與 `b64card`
  - model07（已知無卡片素材）正常試算：結果正確地沒有 `b64card` 欄位
  - Playwright 開 `/admin/game-simulator`：9 個 model tab 皆可切換並
    試算，有卡片圖的 model 正確顯示圖片、model07 正確顯示「無卡片圖
    素材」提示，無 console/網路錯誤
- 回歸驗證：`npm test`（38 支測試腳本，移除 2 支舊腳本、新增 1 支通用
  腳本）全數通過

## 成功標準

- [x] `/admin/game-simulator` 可以切換全部 9 個 model 並實際試算
- [x] 有卡片素材的 model 正確顯示 Python 服務渲染好的卡片圖
- [x] 無卡片素材的 model（07）正確顯示提示文字，不報錯
- [x] 無新增重大 console / runtime error
- [x] 舊的 model02/model03 專屬程式碼與素材已清除，相關測試改用通用
      版本
