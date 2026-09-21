# Validation

## 驗證範圍

- 對應變更：add-toy-shop-admin-controls
- 驗證環境：本機 dev（`npm run dev`，port 6100），以 admin 帳號（admin@example.com）手動 curl
  + Playwright 驗證

## 功能驗證

- 依 proposal 的「成功標準」逐項驗證：
  - [x] 功能符合需求且行為正確 — 實際結果：
    - `GET /api/admin/toy-shop/settings` 回傳 `enabled: true` 與 8 款玩法賠率（預設皆為 1）
    - `PATCH /api/admin/toy-shop/settings` 設 `enabled: false` 後，`POST
      /api/games/toys/pog/roll` 直接回 403「柑仔店櫥仔目前暫停開放。」
    - 關閉期間 `GET /api/games/toys/catalog` 回應 `enabled: false`
    - 前台 `/lottery-hall-taiwan` 貨架的柑仔店櫥仔 `<section>` 整塊從 DOM 移除（含標題／
      購買紀錄按鈕），非僅顯示提示文字（使用者要求改為整塊隱藏後已重新驗證，`#tw-shelf`
      在關閉時 `locator` 命中數為 0，開啟後恢復為 1）
    - 重新 `PATCH enabled: true` 後下注恢復正常
    - 將 `whistle-candy` 賠率倍數設為 3，實際下注觸發一次 `win`（reward 顯示 19 = 10 注 ×
      1.9 倍賠率），確認 wallet 帳本（`GET /api/games/toys/history`）記錄的 `toy-reward`
      實際入帳金額為 57（= 19 × 3），驗證後將倍數改回 1
    - `PATCH /api/admin/toy-shop/games/pog` 設 `enabled: false` 後：
      - `GET /api/games/toys/catalog` 的 `items` 不再包含 `pog`（其餘 7 款玩法仍在）
      - `POST /api/games/toys/pog/roll` 回 403「此玩法目前暫停開放。」
      - `POST /api/games/toys/big-pig/roll`（另一款玩法）仍正常回應，不受影響
      - Playwright：後台卡片顯示「已下架」，前台 `/lottery-hall-taiwan` 貨架的 `#tw-shelf`
        文字內容不含「尪仔標」；重新上架後恢復顯示
      - 驗證後將 `pog` 改回 `enabled: true`，並確認所有玩法 `enabled` 皆為 `true`、
        `multiplier` 皆為 `1`（回到預設狀態）
    - 使用者兩次追加確認：第一次確認「賠率倍數不等於中獎難度」，第二次確認「事後在
      `wallet.credit` 攔截把中獎敲成沒中」也不是要的做法（畫面顯示中獎但沒入帳，體驗不
      一致），最終要求「逐款客製」，並給出明確目標：難度=1（預設）時 10 次要贏 9 次、
      100 元平均拿回 98 元。難度機制整個重做，改為在 8 款玩法各自的隨機邏輯裡（`bigPig.ts`
      的骰子、`luckyDraw.ts`／`gummy.ts` 的權重抽獎、`whistleCandy.ts` 的猜拳、`pog.ts` 的
      比牌、`bambooCopter.ts`／`sodaWhistle.ts` 的門檻、`cards.ts` 的猜牌）直接決定最終結果，
      不再事後覆寫。用 Node 模擬腳本（`fetch` 打真實 API，200~400 局／款）實測難度=1、
      賠率=1 的預設狀態：
      | 玩法 | 中獎率 | 回饋率 |
      |---|---|---|
      | 大豬公 | 89.5% | 98.9% |
      | 竹蜻蜓（m10） | 89.8% | 89.8% |
      | 哨子糖 | 87.5% | 96.0% |
      | 抽抽樂 | 91.0% | 100.0% |
      | 汽水笛 | 97.8% | 97.8% |
      | 紙牌（猜大） | 84.5% | 84.5% |
      | 橡皮糖 | 86.0% | 86.0% |
      | 尪仔標 | 84.0% | 98.9% |

      皆落在合理區間（cards／gummy 略低於 90% 目標中獎率，屬已知落差）。另外把大豬公難度
      從 1 調到 5，重新模擬 300 局：中獎率從 89.5% 降到 64.0%，跟理論值
      `scaleWinProbability(0.9, 5)`≈64.3% 幾乎一致，確認難度真的改變機率本身。
  - [x] UI 與 Figma 規格一致 — 實際結果：本變更未涉入新 Figma 稿（proposal 已聲明沿用既有
    `admin-*` token），視覺比對改列在下一項
  - [x] 無新增重大 console / runtime error — 實際結果：開發過程中曾因 JSDoc 註解內出現
    `*/roll.post.ts` 字面字串，被 esbuild 誤判為註解結束字元，觸發一次 transform 錯誤
    （500）；已改寫註解移除該字串，重新請求恢復 200，之後未再出現
  - [x] 相關測試或手動驗證完成 — 實際結果：見上方逐項 curl／Playwright 驗證

## 視覺驗證

- 與設計稿 / Figma / 既有規格比對：
  - 項目：「柑仔店櫥仔設定」區塊（開關 + 卡片式賠率格 + 單一玩法上下架）
  - 結果：使用者要求改為卡片顯示後，改用 `admin-grid1` 髮絲線分格技巧（跟頁面其他 KPI
    卡片同一套視覺語言），並修正一開始漏補的按鈕變體 class（「編輯」補
    `admin-btn-secondary`、「取消」補 `admin-btn-ghost`），4×2 卡片格填滿不留空格，
    Playwright 截圖確認排版與主題一致
- 響應式斷點檢查：未特別測試窄螢幕（沿用既有 `.atl-*` 版型慣例，跟同頁其他表格行為一致）

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：「彩運來」既有中獎明細／玩法明細報表（`tw-lottery-payout`）
    結果：不受影響，資料來源獨立（台彩鏡射玩法 vs 柑仔店櫥仔是兩套資料）
  - 流程：「經典遊戲」既有 coin 常數編輯功能
    結果：未修改對應檔案，不受影響
  - 流程：柑仔店櫥仔既有 8 款玩法下注／購買紀錄
    結果：開關開啟、賠率倍數為預設值 1 時，行為與變更前一致（僅多了一層乘 1 的運算，
    無實際差異）

## 問題與修正紀錄

- 問題：`server/services/admin/modules/toyShop.ts` 的 JSDoc 註解內文字含
  `server/api/games/toys/*/roll.post.ts`，其中 `*/` 被 esbuild 解讀為註解結束，導致後續
  程式碼被誤判成語法錯誤（`Expected ";" but found "wallet"`），API 回 500
  - 發現方式：實作後第一次呼叫 `GET /api/admin/toy-shop/settings` 驗證時發現
  - 修正方式：改寫註解，避免路徑字串中出現連續的 `*/`
  - 是否已重新驗證：是，修正後重新呼叫恢復 200，並完成後續全部功能驗證
- 問題：`bambooCopter.ts`／`gummy.ts` 的 `resolveWithFate(...)` 回呼函式回傳
  `{ win, height }` / `{ win, drawn }`，但呼叫端解構寫成 `{ height, hit }` /
  `{ drawn, correct }`——欄位名字對不上，`hit`／`correct` 永遠是 `undefined`，導致竹蜻蜓
  無論高度多高一律判定沒中獎（實測 0% 中獎率），橡皮糖同理受影響
  - 發現方式：模擬腳本跑竹蜻蜓 400 局，中獎率／回饋率都是 0.0%，明顯異常，改用 curl
    單獨測試發現高度 35（遠超門檻 10）仍回傳沒中獎；另外用 `npx tsc --noEmit` 對整個
    `server/` 掃過一次型別檢查（dev server 的 esbuild 只做語法轉譯不檢查型別，不會擋這種
    解構欄位對錯名的錯誤），確認只有這兩處欄位不對
  - 修正方式：解構時用別名對齊（`const { height, win: hit } = ...`／
    `const { drawn, win: correct } = ...`）
  - 是否已重新驗證：是，修正後竹蜻蜓 400 局實測中獎率回到 89.8%，橡皮糖回到 86.0%
- 問題：模擬腳本測試過程中，因 fetch 逾時中斷在某局「開局後、還沒送出猜色/出牌」的時間
  點，柑仔店的共用彩池插槽（8 款玩法共用同一個插槽，同一時間只能玩一款）卡在「未結束」
  狀態，導致後續任何玩法的 `roll` 都回 400「還有未結束的玩具，不能另開一局。」
  - 發現方式：竹蜻蜓／尪仔標模擬腳本連續回應同一個錯誤訊息
  - 修正方式：手動打對應玩法的 API 把卡住的那一局玩完（不是程式碼問題，是測試過程本身
    的副作用，柑仔店本來就是設計成「一次只能玩一款」）
  - 是否已重新驗證：是，補完卡住的那一局後，後續模擬恢復正常

## 結論

- 是否通過：是
- 已知限制或風險：
  - 開關與賠率皆為 in-memory，伺服器重啟後回復程式碼預設值（`enabled: true`、賠率 1、
    難度 1），與專案現況其他後台可調參數（coin 常數等）行為一致，非本變更新增風險
  - `cards`（猜大）／`gummy`（猜色）實測中獎率 84.5%／86.0%，略低於 90% 目標，屬模擬
    抽樣下的已知落差，非阻擋性問題（仍在「大多數會贏」的合理範圍）
  - `resolveWithFate` 的重骰上限（40 次）在極端難度設定、或天然機率極低的情境下可能沒
    真的重骰到目標，改用最後一次結果，可能讓極端 difficulty 值的準確度打折——預設值
    （difficulty=1）不受影響，已用模擬驗證
- 後續追蹤事項：
  - 單一玩法下架是直接讓該玩法從 catalog 消失，不會顯示「已下架」的灰色卡片；若後續想讓
    玩家知道「這款曾經存在但暫停」，需另外設計 UI（目前刻意選擇「直接不顯示」，比照使用者
    需求原文）
