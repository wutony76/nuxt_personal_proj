# Tasks

## 1. 剩餘 8 個 model 調查

- [x] 背景 agent 調查剩餘 8 個 model（01、02、04~09）的資料格式複雜度、
      遊戲機制與素材狀況
- [x] 結論：model02 零 BTrees、素材齊全，是最簡單的；model07 無素材；
      model01/05 最複雜（巢狀 BTrees、各自融合 3 個子遊戲）
- [x] 跟使用者確認：一款一款做，從 model02 開始

## 2. 研究 model02 原始邏輯

- [x] 讀 `scratch_model02.py` 的 `get_coin_card()`／`get_play1()`／
      `analyze_card()`，理解 play1（幸運號碼配對）／play2（紅包加碼）／
      play3（純開獎）三段分數融合的結構
- [x] 確認兩個容易誤解、但原始系統既有的設計：裝飾格金額純展示（不是
      派彩）、near-miss 號碼刻意展示但不會中獎

## 3. 資料轉換

- [x] 確認 `data/model02.pkl` 解開後零 BTrees，純 `dict`/`tuple`/`list`/
      `int`，轉成 JSON 核對內容
- [x] 把轉出的機率表原封不動寫進
      `server/services/game/scratch/model02Data.ts`（具名 TS 常數，型別化）

## 4. 消費邏輯實作

- [x] `server/services/game/scratch/model02.ts`：`_getCoinCard`／
      `_getPlay1`／`analyzeModel02Card`，忠實移植洗牌/抽牌/紅包替換邏輯
- [x] 簡化中獎判定：拿掉草稿階段多餘的 `winCells` 清單，改直接用
      `luckSet.has(num)` 判斷（裝飾格與中獎格候選池由建構方式保證互斥）
- [x] 獨立 tsx 腳本驗證邏輯：9 檔目標金額 × 50 次（450 樣本）全數通過
      （10 格／5 格play3／3 個相異幸運號碼／號碼範圍檢查）

## 5. API 與前端

- [x] `server/api/admin/game-simulator/scratch-model02.post.ts`：
      `sessionController.requireAdmin` 保護，驗證 `cardWinCoin`、夾擠
      `count` 到 1~50（沿用 model03 學到的 `Number.isFinite()` 寫法，
      避免 `count=0` 被 `||` 誤判）
- [x] `app/services/api.ts` 新增 `admin.gameSimulator.scratchModel02()`
      與 `ScratchModel02Card`／`ScratchModel02Cell` 型別
- [x] curl 直接呼叫 API 核對：payout 組成正確（yellow 中獎＋紅包＋
      play3 加總＝目標金額）、near-miss 數字正確展示、紅包格替換機制
      正確消耗候選格

## 6. 卡片視覺還原

- [x] 寫通用版一次性 Python 腳本（支援 `.plist` 矩形座標解析＋
      `textureRotated` 旋轉素材），從 `av02_texture.png` 切出 58 張獨立
      透明 PNG，連同底圖存進 `public/images/scratch/model02/`
- [x] 新增 `app/components/admin/ScratchModel02Card.vue`：座標直接沿用
      `get_model02_plist()`，逐行比對確認公式一致；全部換算成百分比
      定位（沿用 model03 的教訓，不用再走一次縮放跑位的回頭路）
- [x] Playwright 驗證：console 無錯誤、圖片素材正確載入
- [x] 發現並確認裝飾用大面額數字（3,000,000）跟相鄰格重疊是原始設計
      既有瑕疵（逐行比對座標公式一致，非移植錯誤）；跟使用者確認後
      選擇忠實保留，不做偏離原始行為的字體縮放或面額排除

## 7. 頁面結構調整：model02／model03 tabs

- [x] 改寫 `app/pages/admin/game-simulator.vue`：原本單一 model03 畫面
      改成 tabs 結構，`state.model02`／`state.model03` 各自獨立狀態
- [x] Playwright 回歸驗證：切到 model03 分頁試算，行為與改版前一致，
      確認重構沒有動到 model03 既有邏輯

## 8. 測試

- [x] 新增 `test/test-scratch-model02.mjs`（19 項）：不合法目標金額
      拒絕、張數夾擠、30 張卡樣本驗證幸運號碼配對/紅包/play3 一致性、
      目標金額 0 的邊界情況
- [x] 加進 `package.json` 的 `test:scratch-model02`（`ci-test-all.mjs`
      自動掃描 `test:*` 腳本，不需要額外登記）
- [x] `npm test`（39 支測試腳本，含新增腳本）：全數通過

## 9. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/add-scratch-model02-simulator.md`
