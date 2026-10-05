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
5. 第一版不搬 PIL 畫卡片圖的功能；使用者實測回報「目前有資料但是沒有
   全部還原與卡片融合的樣子」後追加：直接用 HTML/CSS 疊圖還原卡片視覺
   （不在後端用影像處理套件重畫一張圖）——寫一次性 Python 腳本依材質
   圖集的 `.plist` 座標切出 15 張獨立透明 PNG（底圖＋11 種金額文字＋
   3 種手勢圖示＋1 個中獎紅圈），存進 `public/images/scratch/model03/`；
   新增 `app/components/admin/ScratchModel03Card.vue` 依原始碼座標規律
   疊圖；唯一調整「目標金額」徽章位置（原始碼座標 Y 為負值、會被裁掉）

## 驗證

| 項目 | 方法 | 結果 |
|---|---|---|
| API 行為 | `test/test-scratch-model03.mjs`（12 項） | 全數通過：不合法金額拒絕、張數夾擠、150 局樣本內 getCoin 只在平手時非零且等於面額一半 |
| 真實 bug | 測試過程發現 | `count=0` 被 `Number(body?.count) \|\| 10` 誤判成「沒填」蓋成預設值，改用 `Number.isFinite()` 修正 |
| 人工抽樣 | 直接呼叫 API 核對一筆平手樣本 | 確認「顯示面額＝原始面額×2」「getCoin＝顯示面額的一半」跟原始碼邏輯一致 |
| 面板渲染 | Playwright 開 `/admin/game-simulator` | 表單操作、結果渲染正常，無 console 錯誤 |
| 卡片視覺還原 | Playwright 檢查 DOM 元素數量＋圖片 `naturalWidth` | 600×384px 容器、10 個手勢圖示、5 個金額圖示、對應中獎局數的紅圈皆正確渲染，0 張破圖 |
| 回歸測試 | `npm test` | 38/38（含本次新增腳本），過程中部分測試一次性失敗單獨重跑即全過，確認是既有 transient 現象 |

### 追加：版面對齊——三輪迭代，最終改用 OpenCV 精確量測

使用者連續多輪回報版面跑位，過程：

1. 第一輪肉眼比對後調整間距為 45px/60px，使用者回報「只有一個是準的」
2. 發現手勢跟金額用了兩組不同間距，統一成同一組（55/70），使用者回報
   「目前看都沒有對齊」
3. 改成全部座標換算成百分比，解決容器響應式縮放時寫死 px 失準的問題，
   使用者回報「有接近一些，有辦法更準嗎」
4. **改用 OpenCV 的 Hough circle transform 直接在 `card-base.jpg` 上
   偵測 10 個手勢圈圈的精確圓心像素座標**——證實原始碼的 `35/65`
   固定間距其實正確，先前兩次調整（45/60、55/70）都是肉眼比對不夠
   精確導致的誤判
5. 進一步發現底圖是人工排版、逐局間距有 ±10px 自然落差，改成逐局
   寫死精確座標（`HAND_POSITIONS`）取代「起始點＋固定間距」公式，
   Playwright 程式化比對渲染結果，誤差收斂到 **0.0px**
6. 使用者確認手勢對齊，但回報金額文字框位置仍不準；比照手勢的做法，
   裁切放大底圖逐局量測文字框實際中心點，取代原始碼 `+65/+10` 的
   猜測值，改用 CSS `transform: translate(-50%, -50%)` 置中解決
   11 種金額寬度不一的問題，誤差收斂到 **±2px 內**

**教訓**：版面對齊問題，肉眼比對壓縮截圖永遠帶著不確定性，尤其當
誤差本身不均勻（人工排版，不是數學座標）。用程式直接在素材原始檔上
量測、程式化比對渲染結果，才能真正收斂，不是一輪一輪猜數字。

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
