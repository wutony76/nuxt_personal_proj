# Tasks

## 1. 研究原始 Python 專案

- [x] 確認 9 個 model 的 `.pkl` 資料型別：model01/02/03 是純
      dict/tuple/list/int，model04~09 包了 `BTrees.OOBTree`，皆可解開
      轉成 JSON、不需要重新計算機率
- [x] 跟使用者確認整合方式：在 Nuxt 專案內用 TS 重新實作消費邏輯，不跑
      獨立 Python server、不做 proxy
- [x] 跟使用者確認先做 model03（最簡單）當驗證範本
- [x] 讀 `scratch_model03.py` 的 `get_coin_card()`／`get_play1()`／
      `analyze_card()`／`write_model03()`，完整理解機率表結構與消費流程
- [x] 發現 model03 原始碼「得到金額」只在平手時非零、跟頁面規則文字不
      一致，跟使用者確認忠實移植、不擅自修正

## 2. 資料轉換

- [x] 寫一次性 Python 腳本解開 `data/model03.pkl`，確認型別皆為 plain
      int/tuple/list，轉成 JSON 核對內容
- [x] 把轉出的機率表原封不動寫進
      `server/services/game/scratch/model03Data.ts`（具名 TS 常數，型別化）

## 3. 消費邏輯實作

- [x] `server/services/game/scratch/model03.ts`：`_getCoinCard`／
      `_getPlay1`／`analyzeModel03Card`，忠實移植洗牌/抽牌/輪詢池邏輯
- [x] 模組層級的手勢組合輪詢池（`_rotatingHandPool`），行為對應 Python
      版的 process-wide 單例

## 4. API 與前端

- [x] `server/api/admin/game-simulator/scratch-model03.post.ts`：
      `sessionController.requireAdmin` 保護，驗證 `cardWinCoin`、夾擠
      `count` 到 1~50
- [x] `app/services/api.ts` 新增 `admin.gameSimulator.scratchModel03()`
      與 `ScratchModel03Card`／`ScratchModel03Round` 型別
- [x] `app/pages/admin/game-simulator.vue`：表單（目標金額/張數）＋結果
      顯示（5 局卡片），取代原本的 `AdminComingSoon` 佔位

## 5. 測試

- [x] 新增 `test/test-scratch-model03.mjs`：不合法目標金額拒絕、張數
      夾擠、機率表消費邏輯一致性（150 局樣本驗證 getCoin 只在平手時
      非零）、目標金額 0 的邊界情況
- [x] 測試過程中抓到真實 bug：API 端 `count` 參數用
      `Number(body?.count) || 10` 處理，`0` 是合法但 falsy 的值，被誤判
      成「沒填」蓋成預設值 10；改用 `Number.isFinite()` 判斷修正
- [x] 加進 `package.json` 的 `test:scratch-model03`（`ci-test-all.mjs`
      自動掃描 `test:*` 腳本，不需要額外登記）
- [x] Playwright 開 `/admin/game-simulator`：填表單、送出試算、確認結果
      正確渲染、無 console 錯誤
- [x] `npm test`（38 支測試腳本）：全數通過，執行過程中出現的
      `test:bg` 單次失敗單獨重跑即全過，確認是本次改動觸發 Nitro 重啟、
      跟 dev-only 自動測試電池撞期的既有 transient 現象

## 6. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/add-scratch-model03-simulator.md`

## 7. 追加：卡片視覺還原

- [x] 使用者實測回報「目前有資料但是沒有全部還原與卡片融合的樣子」
- [x] 讀 `get_scratch_card.py` 的 `get_model03()`／`get_model03_plist()`，
      理解底圖＋材質圖集疊圖邏輯與版面座標規律
- [x] 用一次性 Python 腳本依 `av03_texture.plist` 的矩形座標，從
      `av03_texture.png` 切出 15 張獨立透明 PNG（11 種金額文字、3 種
      手勢圖示、1 個中獎紅圈），連同底圖 JPG 存進
      `public/images/scratch/model03/`
- [x] 擴充 `Model03RoundResult`／`ScratchModel03Round` 型別，新增
      `handValues`（雙方猜拳手勢原始數值），供前端挑選對應手勢圖示
- [x] 新增 `app/components/admin/ScratchModel03Card.vue`：純展示用元件，
      依原始碼的 `cx += 35, cy += 65` 規律疊圖，中獎局疊紅圈
- [x] 調整「目標金額」大徽章位置（原始碼座標 Y 為負值、疊圖時會被裁掉，
      改放右上角徽章）
- [x] Playwright 驗證：圖片素材皆正確載入（`naturalWidth > 0`）、DOM
      元素數量正確（10 個手勢圖示、5 個金額圖示）、無 console 錯誤
- [x] `npm test`（38 支測試腳本）：全數通過，過程中的失敗項目單獨重跑
      即全過，確認是既有 transient 現象

## 8. 追加：版面對齊微調

- [x] 使用者實機比對回報「回合數的猜拳結果與金額有點跑位」，提供具體
      調整值：每局 left 間距 10px+45px、top 間距 10px+60px（原本忠實沿用
      原始碼的 35px／65px）
- [x] 改成具名常數 `ROUND_STEP_LEFT = 45`／`ROUND_STEP_TOP = 60`，套用到
      我的手勢／對手手勢／金額／中獎紅圈四個位置計算
- [x] Playwright 截圖確認 5 局圖示皆正確落在底圖事先印好的圈圈位置內
- [x] `npm test`（38 支）：全數通過

## 9. 追加：改用 OpenCV 精確量測取代肉眼比對

- [x] 使用者回報「目前看都沒有對齊」，提供截圖
- [x] 懷疑是容器在版面擠壓時縮放、但子元素寫死 px 的響應式問題，改成全部
      座標換算成百分比（`pctX`／`pctY`），實測寬/窄兩種容器寬度皆正確
- [x] 使用者再次回報「有接近一些，有辦法更準嗎」，提供第二張參考截圖
- [x] 改用 OpenCV 的 Hough circle transform 直接在 `card-base.jpg` 上偵測
      10 個手勢圈圈的精確圓心像素座標，取代肉眼比對：證實原始碼的
      `35/65` 固定間距其實正確，先前改成 45/60、55/70 都是誤判
- [x] 發現底圖是人工排版、逐局間距有 ±10px 自然落差，改成逐局寫死精確
      座標（`HAND_POSITIONS`），放棄「起始點＋固定間距」公式；寫 Playwright
      腳本程式化比對渲染結果跟量測值的誤差，從 0px 驗證到位
- [x] 使用者確認手勢對齊，回報「smc-sprite smc-coin 剩下這個的位置沒有準」
- [x] 裁切放大底圖 5 局分別測量金額文字框的實際中心點，取代原始碼
      `+65/+10` 的猜測值；改用 CSS `transform: translate(-50%, -50%)`
      置中，解決 11 種金額文字框寬度不一的置中問題
- [x] Playwright 程式化比對：5 局金額框誤差皆在 ±2px 內
- [x] 移除除錯用的綠色外框樣式
- [x] `npm test`（38 支）：全數通過，過程中部分測試一次性失敗單獨重跑
      即全過，確認是既有 transient 現象（含 bingo 結算中的正常輪詢窗口，
      非卡死 bug）
