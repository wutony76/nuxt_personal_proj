# Tasks

## 1. 發現既有 API，確認架構轉向

- [x] 使用者提及可以改用 `http://127.0.0.1:8000/api/scratch/01?coin=
      1000&count=3` 抓資料，實測確認這支 API 真的存在且可用
- [x] 讀 `admin_site/api_views.py`，理解 `/api/scratch/<model_id>` 與
      `/api/scratch/info` 的參數、回傳格式、驗證邏輯、model07 無
      `b64card` 的特例
- [x] 跟使用者確認改動範圍：全部改成呼叫這支 API（含已完成的
      model02/model03），且這支 Python 服務是使用者自己長期在跑的本機
      開發用服務

## 2. Nuxt 後端薄代理層

- [x] `server/api/admin/game-simulator/scratch-info.get.ts`：轉發
      `/api/scratch/info`，連線失敗回 502 並附上目前連的網址
- [x] `server/api/admin/game-simulator/scratch.get.ts`：轉發
      `/api/scratch/<model>?coin=&count=&image=1`，把 Python 服務的
      400/404 錯誤內容轉成 Nuxt `createError`

## 3. 刪除舊的 model02/model03 專屬實作

- [x] 刪除 `server/services/game/scratch/`（`model02.ts`／
      `model02Data.ts`／`model03.ts`／`model03Data.ts`）
- [x] 刪除 `server/api/admin/game-simulator/scratch-model02.post.ts`／
      `scratch-model03.post.ts`
- [x] 刪除 `app/components/admin/ScratchModel02Card.vue`／
      `ScratchModel03Card.vue`
- [x] 刪除 `public/images/scratch/`（model02/03 素材資料夾）
- [x] 刪除 `test/test-scratch-model02.mjs`／`test-scratch-model03.mjs`，
      `package.json` 移除對應的 `test:scratch-model02`／
      `test:scratch-model03`
- [x] `app/services/api.ts`：移除 `ScratchModel02*`／`ScratchModel03*`
      型別與 `scratchModel02()`／`scratchModel03()` 呼叫

## 4. 前端改寫

- [x] `app/services/api.ts` 新增通用型別 `ScratchSimResult`／
      `ScratchSimResponse`／`ScratchModelInfo`／`ScratchInfoResponse`，
      與 `admin.gameSimulator.scratchInfo()`／`scratch()` 呼叫
- [x] `app/pages/admin/game-simulator.vue` 改寫成通用畫面：9 個 model
      動態 tab（名稱與金額選項皆來自 `scratch-info`）、卡片圖
      （`b64card`，有的話）＋格式化 JSON 原始資料（`<details>` 收合）

## 5. 測試

- [x] 新增 `test/test-scratch-sim.mjs`：偵測不到本機 Python 服務時
      直接略過（exit 0，不當 CI 失敗）；服務在線時驗證 model 清單、
      不合法 model/金額拒絕、張數夾擠、model02 正常試算含卡片圖、
      model07 正確地沒有卡片圖
- [x] 加進 `package.json` 的 `test:scratch-sim`
- [x] Playwright 開 `/admin/game-simulator`：9 個 model tab 皆可切換
      並試算，一般 model 正確顯示卡片圖、model07 正確顯示無素材提示，
      無 console/網路錯誤
- [x] `npm test`（38 支測試腳本，移除 2 支舊腳本、新增 1 支）：全數
      通過

## 6. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增
      `docs/Engineering Evidence/replace-scratch-simulator-with-python-proxy.md`
- [x] 在舊的 `add-scratch-model02-simulator`／
      `add-scratch-model03-simulator` 的 `proposal.md` 加註已被本次
      變更取代，保留文件本身當歷史紀錄

## 7. 追加：commit 後使用者實測回報的兩個問題

- [x] 使用者回報「API 圖片抓到的內容與 avscratch_all 抓到的內容不太
      一樣」，追查後確認：兩邊是同一個 `analyze_card()`／同一份
      `b64card`，差異只是隨機抽卡本身——但發現頁面預設金額固定挑
      `valid_coins[0]`（每個 model 都是 0），0 分的卡不會有任何中獎
      紅圈，看起來比 `avscratch_all` 預設隨機抽非 0 金額的卡「黯淡」；
      改成進頁與切換 model 時都隨機挑一個非 0 金額（`_pickDefaultCoin`，
      對應 `avscratch_test_views.py` 的
      `random.choice([c for c in valid_coins if c > 0] or valid_coins)`）
- [x] 使用者回報「只有 01~04 是正常的，其他的都有錯誤」，追查後確認：
      model05/06/08/09 的 `analyze_card()` 回傳的 `analyze_data`
      **完全沒有 `win_coin` 欄位**（`image=0` 時 `results[0]` 是空物件
      `{}`），原始系統的 `avscratch_all_models_view` 本來就用
      `data.get('win_coin', coin)` 退回成呼叫時的金額；我的頁面原本
      寫死 `result.win_coin.toLocaleString(...)`，沒有這個退回，
      `win_coin` 是 `undefined` 時整頁直接 TypeError
- [x] 修正：`result.win_coin` 改成 `??` state.coin` 退回；
      `ScratchSimResult.win_coin` 型別改成可選（`number | undefined`）
      並加註說明；`test-scratch-sim.mjs` 新增 model05 的回歸測試，鎖定
      「這個欄位本來就會缺」這個事實，避免之後誤改成假設一定有值
- [x] Playwright 逐一切換全部 9 個 model 試算，確認皆無 console 錯誤、
      得獎金額皆正確顯示（05/06/08/09 正確退回成呼叫時的金額）
- [x] `npm run test:scratch-sim`（17 項）全數通過

## 8. 追加：model tab 改用正式名稱

- [x] 使用者提供全部 9 個 model 的正式中文名稱（跟
      `avscratch_test_views.py` 的 `ALL_MODEL_NAMES` 一致），因為
      `/api/scratch/info` 的 `MODEL_NAMES` 只填了 01／07，其餘還是
      「Model 0X」佔位字串
- [x] 新增前端常數 `MODEL_LABELS` 覆蓋 tab 顯示文字，不用等 Python 端
      補完；Playwright 實測 9 個 tab 文字皆正確、無 console 錯誤

## 9. 追加：Demo 角色打不了遊戲試算

- [x] 使用者要求 Demo 角色（唯讀瀏覽後台的內建角色，見
      `roleDefs.ts`）需要能使用「遊戲試算」功能
- [x] 追查發現兩支代理 API 誤用 `sessionController.requireAdmin`
      （僅白名單 admin 可過），應該跟專案其他純讀取 admin 端點一樣用
      `requireAdminView`（白名單 admin 或 demoMode 角色皆可通過）——
      這支工具本來就是純模擬運算、不扣款不派彩不寫入任何玩家帳務，
      沒有理由比照寫入端點的權限門檻
- [x] 改用 `requireAdminView`；用內建 demo 展示帳號
      `test04@test.cc`／`222222` 實測確認 `scratch-info`／`scratch`
      兩支端點皆從 403 變成可正常回應
- [x] `test/test-roles.mjs` 新增回歸測試：demo 角色打
      `/api/admin/game-simulator/scratch-info` 不應被 403 擋下（不要求
      一定是 200，因為這支端點依賴使用者本機可選的 Python 服務，服務
      沒開時回 502 是另一回事，不代表 RBAC 設錯）
- [x] `npm test`（38 支）全數通過
