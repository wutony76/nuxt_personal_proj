# Engineering Evidence：刮刮樂 model03 試算工具

## 變更摘要

- **對應變更**：`add-scratch-model03-simulator`
- **變更檔案**：
  - `server/services/game/scratch/model03Data.ts`（新增，機率表資料）
  - `server/services/game/scratch/model03.ts`（新增，消費邏輯）
  - `server/api/admin/game-simulator/scratch-model03.post.ts`（新增）
  - `app/pages/admin/game-simulator.vue`（改寫，取代佔位頁）
  - `app/services/api.ts`（新增型別與呼叫）
  - `test/test-scratch-model03.mjs`（新增）
  - `package.json`（新增 `test:scratch-model03`）

### 背景

使用者要求把外部 Python 專案 `py3_AVScratch_proj`（Django 寫的刮刮樂機率
試算系統，9 個 model）的「試算」功能整合進這個 Nuxt 專案的
`/admin/game-simulator` 空殼頁面。跟使用者確認後，決定在 Nuxt 內用
TypeScript 重新實作消費邏輯（不另外跑 Python server），先做最簡單的
model03（剪刀石頭布）當驗證範本。

### 做法

1. 確認 `.pkl` 資料本身可以直接沿用：解開後是純 `dict`/`tuple`/`list`/
   `int`（model04~09 包了 `BTrees.OOBTree`，但也只是個可迭代的容器，一樣
   能轉成 JSON），不需要重新計算機率
2. 把轉出的機率表原封不動寫成 TypeScript 具名常數
3. 用 TypeScript 忠實重寫 `get_coin_card()`／`get_play1()`／
   `analyze_card()` 的消費邏輯，包含模組層級的「手勢組合輪詢池」
   （洗牌→pop→空了重新洗牌補滿）
4. 刻意保留一個跟頁面規則文字不一致的既有行為：「得到金額」只在雙方
   手勢完全相同（平手）時才算出非零值，猜拳規則下「贏」必然手勢不同，
   所以「贏」這個狀態的「得到金額」永遠是 0——跟使用者確認忠實移植、
   不擅自修正
5. 不搬 PIL 畫卡片圖的功能（後台驗證工具，圖片渲染對驗證數字正確性
   沒有幫助）

## 驗證

| 項目 | 方法 | 結果 |
|---|---|---|
| API 行為 | `test/test-scratch-model03.mjs`（12 項） | 全數通過：不合法金額拒絕、張數夾擠、150 局樣本內 getCoin 只在平手時非零且等於面額一半 |
| 真實 bug | 測試過程發現 | `count=0` 被 `Number(body?.count) \|\| 10` 誤判成「沒填」蓋成預設值，改用 `Number.isFinite()` 修正 |
| 人工抽樣 | 直接呼叫 API 核對一筆平手樣本 | 確認「顯示面額＝原始面額×2」「getCoin＝顯示面額的一半」跟原始碼邏輯一致 |
| 面板渲染 | Playwright 開 `/admin/game-simulator` | 表單操作、結果渲染正常，無 console 錯誤 |
| 回歸測試 | `npm test` | 38/38（含本次新增腳本），過程中 `test:bg` 一次性失敗單獨重跑即全過，確認是既有 transient 現象 |

## 風險與後續

- 已知風險：忠實移植的「贏永遠得 0」行為容易被誤認為是這次移植引入的
  bug——已在 `model03.ts` 檔頭、API 檔案、頁面文案、本文件都清楚標註
- 後續追蹤事項：
  - 其餘 8 個 model（01/02 規則更複雜，04~09 底層資料是
    `BTrees.OOBTree`）留待之後視需要再評估是否擴充
  - 若之後要做「玩家實際可玩的刮刮樂遊戲」（不只是後台試算工具），需要
    另外設計卡片視覺呈現與錢包經濟迴圈整合，屬於完全不同範疇的工作

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [x] `npm test` 38/38（其餘失敗項目確認為既有 transient 現象）
- [ ] `openspec archive`
