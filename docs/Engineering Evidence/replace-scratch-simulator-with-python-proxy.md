# Engineering Evidence：刮刮樂試算工具改用 Python API 代理

## 變更摘要

- **對應變更**：`replace-scratch-simulator-with-python-proxy`（取代、
  廢止 `add-scratch-model02-simulator`／`add-scratch-model03-simulator`）
- **變更檔案**：
  - 新增：`server/api/admin/game-simulator/scratch-info.get.ts`、
    `scratch.get.ts`
  - 改寫：`app/pages/admin/game-simulator.vue`（單一通用畫面）、
    `app/services/api.ts`（通用型別與呼叫）
  - 新增：`test/test-scratch-sim.mjs`，`package.json` 新增
    `test:scratch-sim`
  - 刪除：`server/services/game/scratch/`（model02/03 機率表與消費
    邏輯）、`server/api/admin/game-simulator/scratch-model02.post.ts`／
    `scratch-model03.post.ts`、`app/components/admin/
    ScratchModel02Card.vue`／`ScratchModel03Card.vue`、
    `public/images/scratch/`（素材資料夾）、
    `test/test-scratch-model02.mjs`／`test-scratch-model03.mjs`

### 背景

先前兩個 change 已經完整做完 model02／model03 的「移植機率表＋重寫
消費邏輯＋HTML/CSS 疊圖還原卡片視覺」——model03 的視覺對齊過程甚至
動用 OpenCV Hough circle transform 才把誤差收斂到 0px。使用者接著指出
原始 Python 專案 `py3_AVScratch_proj` 其實已經有一支現成的 REST API
（`/api/scratch/<model_id>`），連卡片圖都用 base64 一起回傳，且這支
服務他自己會長期在本機跑著。跟使用者確認後，決定整個試算工具改成
直接轉呼叫這支 API，**包含已經做完的 model02/model03 也一併改掉**。

### 做法

1. 實測確認這支 API 的行為：`model_id` 01~09 驗證、`coin` 合法性檢查
   （連 `valid_coins` 清單都回傳）、`count` 夾擠到 1~50、`image=0/1`
   控制是否含圖、model07 的特例（`analyze_card()` 只回 2 個值，
   回應裡沒有 `b64card`，確認是 Python 服務本身就知道這件事，不是
   要前端另外維護）
2. 發現 `/api/scratch/info`：列出全部 9 個 model 的名稱與支援金額，
   讓前端可以完全動態組出選單，不用寫死任何清單
3. Nuxt 端寫兩支薄代理 API，只做身份驗證＋轉發＋錯誤格式轉換，不碰
   任何業務邏輯；外部服務網址用
   `process.env.SCRATCH_PY_API_BASE || 'http://127.0.0.1:8000'`
   （沿用專案既有的 `process.env.X || 預設值` 慣例）
4. `game-simulator.vue` 從「tabs 切換 model02/model03、各自獨立表單與
   卡片元件」簡化成單一通用畫面：9 個 model 動態 tab、卡片圖直接顯示
   `b64card`（有的話）、原始資料用格式化 JSON 放進可收合的
   `<details>`——不逐 model 刻版面，因為每個 model 的
   `play_one`/`play_two`/`play_three` 形狀都不同，而卡片圖本身已經是
   正式系統的渲染結果，不需要重新發明視覺呈現
5. 刪除 model02/03 的機率表、消費邏輯、卡片視覺元件、素材資料夾、
   專屬測試；舊的兩份 change 文件保留在 `openspec/changes/` 當歷史
   紀錄，加註已被取代

## 驗證

| 項目 | 方法 | 結果 |
|---|---|---|
| API 行為 | `test/test-scratch-sim.mjs`（17 項，本機 Python 服務在線時） | 全數通過：model 清單、不合法 model/金額拒絕、張數夾擠、model02 正常試算含卡片圖、model07 正確無卡片圖、model05 正確沒有 win_coin 欄位 |
| 面板渲染 | Playwright 開 `/admin/game-simulator` | 9 個 model tab 皆可切換並試算，一般 model 正確顯示卡片圖，model07 正確顯示無素材提示，無 console/網路錯誤 |
| 回歸測試 | `npm test` | 38/38（移除 2 支舊腳本、新增 1 支通用腳本） |

### 追加：commit 後使用者實測回報兩個問題，皆已修正

1. **「API 圖片內容跟 avscratch_all 不太一樣」**：逐一比對同 model/同
   金額的 `b64card`，確認兩邊是同一個 `analyze_card()` 產出、版面與
   字型完全一致，差異只是隨機抽卡；但發現根因——頁面預設金額固定挑
   `valid_coins[0]`（每個 model 清單第一個都是 0），0 分的卡沒有任何
   中獎紅圈，視覺上確實比 `avscratch_all` 預設隨機抽非 0 金額的卡
   「黯淡」。修正：進頁與切換 model 時都隨機挑一個非 0 金額
   （`_pickDefaultCoin`，對應原始測試頁 `avscratch_test_views.py` 的
   `random.choice([c for c in valid_coins if c > 0] or valid_coins)`）
2. **「只有 01~04 正常，其他的都有錯誤」**：追查確認 model05/06/08/09
   的 `analyze_card()` 完全不回傳 `win_coin` 欄位（`image=0` 時
   `results[0]` 是空物件 `{}`），原本頁面寫死
   `result.win_coin.toLocaleString(...)` 沒有退回機制，`undefined`
   直接讓整頁 TypeError。修正為 `result.win_coin ?? state.coin`（對應
   原始系統 `avscratch_test_views.py` 的 `data.get('win_coin', coin)`
   退回邏輯），型別改成可選並加註說明，`test-scratch-sim.mjs` 新增
   model05 的回歸測試鎖定這個「本來就會缺欄位」的事實

兩個修正都用 Playwright 實測逐一切換全部 9 個 model 試算確認無
console 錯誤，`test-scratch-sim.mjs`（17 項）全數通過。

### 追加：model tab 改用正式名稱、Demo 角色打不了遊戲試算

1. **model tab 名稱**：`/api/scratch/info` 的 `MODEL_NAMES` 只填了
   01／07，其餘還是「Model 0X」佔位字串。使用者提供跟
   `avscratch_test_views.py` 的 `ALL_MODEL_NAMES` 一致的正式中文名稱，
   新增前端常數 `MODEL_LABELS` 覆蓋 tab 顯示文字，不用等 Python 端補完
2. **Demo 角色打不了遊戲試算**：兩支代理 API 誤用
   `sessionController.requireAdmin`（僅白名單 admin 可過），應該跟
   專案其他純讀取 admin 端點一樣用 `requireAdminView`（白名單 admin 或
   demoMode 角色皆可通過）——這支工具本來就是純模擬運算、不扣款不派彩
   不寫入任何玩家帳務，沒有理由比照寫入端點的權限門檻。改用
   `requireAdminView` 後，用內建 demo 展示帳號 `test04@test.cc`／
   `222222` 實測確認兩支端點皆從 403 變成可正常回應；`test-roles.mjs`
   新增回歸測試鎖定這個行為

`npm test`（38 支）全數通過。

## 風險與後續

- **已知風險（本次變更引入）**：這支工具現在完全依賴使用者本機的
  Python 服務是否有在跑，不是 Nuxt 專案自帶的能力
  - 已緩解：代理 API 連線失敗時回傳清楚的 502 錯誤（附上連線網址）；
    `test-scratch-sim.mjs` 偵測不到服務時直接略過（exit 0），不會讓
    其他開發者或 CI 環境因為這個可選依賴誤判成回歸
  - 風險被接受的前提：`/admin/game-simulator` 本來就是內部管理員用的
    試算驗證工具，不是玩家會用到的正式功能，使用者本人確認這支
    Python 服務是他自己長期在跑的本機開發用服務
- 已知限制：model01~09 除了 01（十二生肖）、07（點十成黃金）有正式
  名稱，其餘 7 個目前 Python API 回傳的名稱還是「Model 0X」佔位字串
  （Python 專案本身的 `MODEL_NAMES` 字典還沒填完整，非這次變更範圍）
- 後續追蹤事項：
  - 若未來要讓其他開發者或 CI 環境也能完整驗證（不依賴使用者本機
    服務），需要另外討論是否把 Python 服務容器化或提供本地假資料模式
  - 若之後要做「玩家實際可玩的刮刮樂遊戲」，仍需要另外設計卡片視覺
    呈現與錢包經濟迴圈整合，這支代理工具的做法（依賴外部服務、不管
    正式渲染）不適用於那個情境

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [x] `npm test` 38/38
- [ ] `openspec archive`
