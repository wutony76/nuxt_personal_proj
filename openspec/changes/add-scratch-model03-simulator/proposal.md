# Proposal

> ⚠️ **本 change 已被 `replace-scratch-simulator-with-python-proxy` 取代**
> ——改成直接轉呼叫原始 Python 專案既有的 REST API（連卡片圖都一併
> 回傳），這裡移植的機率表、消費邏輯、卡片視覺元件、素材資料夾皆已
> 刪除。本文件保留當歷史紀錄，記錄當初的移植過程、OpenCV 精確量測
> 等踩過的坑。

## 變更名稱

add-scratch-model03-simulator — 在 `/admin/game-simulator` 加入刮刮樂
model03（剪刀石頭布）機率/派彩試算工具

## 背景

使用者要求把另一個獨立專案 `py3_AVScratch_proj`（Python/Django 寫的刮刮樂
機率試算系統，9 個 model，各自用 BTrees／`.pkl` 預先計算好的機率表＋PIL
畫卡片圖）的「試算」功能，整合進這個 Nuxt 專案目前只是空殼的
`/admin/game-simulator` 頁面（原本就是為此預留的導覽入口，見
`app/pages/admin/game-simulator.vue` 的既有描述「本次僅建立導覽入口」）。

兩個專案完全是不同技術堆疊，經跟使用者確認後決定：**在 Nuxt 專案內用
TypeScript 重新實作機率消費邏輯**，不是讓 Python server 另外跑、也不是
走 proxy 整合（維持單一 Node 全端架構）。

進一步確認：9 個 model 的 `.pkl` 資料本身（machine01/02/03 是純
dict/tuple/list/int，04~09 是包了 `BTrees.OOBTree` 的容器，皆可解開轉成
JSON）可以直接沿用、不用重新計算機率；但「怎麼用這份表抽出結果」的消費
邏輯（各 model 的 `scratch_modelXX.py`）必須重新用 TypeScript 實作，9 個
model 彼此規則不完全一樣。

本次先做**最簡單的 model03**（剪刀石頭布，5 局合一張卡）當作驗證範本，
確認整條 pipeline（`.pkl` → JSON 資料 → TS 消費邏輯 → 後台試算頁）走得通；
其餘 8 個 model 之後視需要再擴充，不在本次範圍內。

移植過程中發現 model03 原始程式碼有個跟頁面規則文字不一致的行為：規則
文字寫「贏得獎金、平手得一半」，但 `analyze_card()` 的「得到金額」計算
只在雙方手勢完全相同（平手）時才算出非零值，猜拳規則下「贏」必然雙方
手勢不同，所以「贏」這個狀態的「得到金額」永遠是 0。跟使用者確認後，
決定**忠實移植這個既有行為，不擅自修正**，在程式碼與文件裡清楚標註。

## 目標

- `/admin/game-simulator` 提供 model03 的試算介面：選目標金額、輸入模擬
  張數，顯示每張卡 5 局的手勢對戰、面額、得到金額
- 機率表資料忠實保留原始 `.pkl` 內容（不重新計算），消費邏輯忠實移植
  （含上述已知的規則文字/實際行為落差）
- 純模擬運算，不扣款、不派彩、不寫入任何玩家帳務資料

## 範圍

- 包含：
  - `server/services/game/scratch/model03Data.ts`（機率表資料，從
    `.pkl` 轉出）
  - `server/services/game/scratch/model03.ts`（消費邏輯：抽卡／5 局
    猜拳判定／組出顯示用結果）
  - `server/api/admin/game-simulator/scratch-model03.post.ts`（試算
    API，純運算、不碰 `Storage`）
  - `app/pages/admin/game-simulator.vue`（試算表單＋結果顯示，取代原本
    的 `AdminComingSoon` 佔位）
  - `app/services/api.ts`（新增 `admin.gameSimulator.scratchModel03()`
    與對應型別）
  - `test/test-scratch-model03.mjs`（機率表消費邏輯一致性測試）
- 不包含：
  - 不做其餘 8 個 model（04~09 用 BTrees、01/02 規則更複雜，留待之後視
    需要再擴充）
  - 不把刮刮樂做成玩家可玩的真實遊戲（不碰 `Storage`、不接錢包經濟迴圈）

### 追加：卡片視覺還原

第一版只做純文字結果表格，使用者實際使用後回報「目前有資料但是沒有
全部還原與卡片融合的樣子」，要求補上跟原始系統一樣、手勢/金額疊在底圖
卡片上的視覺呈現。追加做法：直接用 HTML/CSS 疊圖（不是在後端用影像處理
套件重畫一張圖），素材（底圖 JPG＋材質圖集切出的 15 張小圖）取自原始
Python 專案，版面座標忠實沿用原始碼，詳見 `design.md`。

## 影響面

- 後端 API/Services：新增 `server/services/game/scratch/`、新增一支
  admin API
- 前端路由/頁面：`app/pages/admin/game-simulator.vue`（原本是空殼佔位頁）
- 設定或常數：新增 `model03Data.ts`（機率表資料）

## 風險與對策

- 技術風險：
  - 風險：忠實移植的「贏永遠得 0」行為容易被誤認為是這次移植引入的 bug
  - 對策：程式碼註解、頁面文案、本文件都明確標註這是原始系統既有行為、
    經使用者確認刻意保留，不是這次移植造成的
  - 風險：`count` 參數邊界值（例如 0）若用 `|| 預設值` 這種寫法處理，會
    把合法的 0 誤判成「沒填」——已被 `test-scratch-model03.mjs` 抓到並
    修正（改用 `Number.isFinite()` 判斷）
- UI/UX 風險：
  - 風險：無——純粹補上原本就是佔位的頁面功能

## 驗證方式

- 功能驗證：
  - 直接呼叫 API 驗證：不合法目標金額拒絕、張數上限/下限夾擠正確
  - 150 局樣本內驗證「得到金額」只在雙方手勢相同時才非零，且剛好是面額
    的一半
  - Playwright 開 `/admin/game-simulator`，實際跑一次試算，確認畫面渲染
    正確、無 console 錯誤
- 回歸驗證：`npm test`（38 支測試腳本）全數通過或確認失敗項目與本次變更
  無關

## 成功標準

- [x] `/admin/game-simulator` 可以實際試算 model03，顯示正確的 5 局結果
- [x] 機率表消費邏輯忠實移植，含已知的規則文字/實際行為落差，已清楚標註
- [x] 無新增重大 console / runtime error
- [x] 相關測試驗證完成
