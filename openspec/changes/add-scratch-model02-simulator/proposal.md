# Proposal

> ⚠️ **本 change 已被 `replace-scratch-simulator-with-python-proxy` 取代**
> ——改成直接轉呼叫原始 Python 專案既有的 REST API（連卡片圖都一併
> 回傳），這裡移植的機率表、消費邏輯、卡片視覺元件、素材資料夾皆已
> 刪除。本文件保留當歷史紀錄，記錄當初的移植過程與踩過的坑。

## 變更名稱

add-scratch-model02-simulator — 在 `/admin/game-simulator` 加入刮刮樂
model02（紅包任你刮／幸運號碼配對）機率/派彩試算工具

## 背景

延續 `add-scratch-model03-simulator` 的整合方式（Nuxt 內用 TypeScript
重新實作機率消費邏輯、沿用原始 `.pkl` 機率表、不跑獨立 Python server），
使用者接著要求「其他的刮刮樂玩法可以幫我加進來」。先請一個背景 agent
調查剩餘 8 個 model（01、02、04~09）的資料格式複雜度、遊戲機制與素材
狀況，結論：model02 零 BTrees（跟 model03 一樣是純 dict/tuple/list/int）、
素材齊全，是剩餘 8 個裡最簡單的；model07 完全沒有卡片素材（資料夾不
存在）；model01/05 最複雜（巢狀 BTrees、各自融合 3 個子遊戲）。跟使用者
確認後，決定**一款一款做，從 model02 開始**。

本次做 model02：卡片由 3 段機率分數融合而成——

- **play1（幸運號碼配對）**：15~60 隨機抽 3 個「幸運號碼」顯示在卡片
  上方，玩家 10 個號碼格裡有幾格是幸運號碼的複本（中獎格）
- **play2（紅包加碼）**：決定要不要把其中幾格換成「紅包」特殊格（紅包
  必中）
- **play3（純 5 格開獎）**：5 格各自直接開出金額，全部視為中獎

`cardWinCoin`（目標金額）＝ play1 分數 ＋ play2 分數 ＋ play3 分數，三者
組合已經先篩過（`WIN_COINS_COMB`），保證加總等於目標金額。

移植過程中確認兩個容易被誤解、但是原始系統既有設計的行為（不是 bug）：

1. 10 格裡沒對中幸運號碼的格子，一樣會顯示一個隨機金額數字（從完整的
   `PLAY2_WIN_COINS` 挑），但那只是裝飾用，不是真的派彩
2. 跟幸運號碼「差 1」的數字（near-miss）會被刻意排除在裝飾池之外、但
   保留展示在卡片上，製造「差一點就中」的效果，這些格子同樣不會中獎

## 目標

- `/admin/game-simulator` 支援切換 model02／model03（頁面改成 tabs 結構）
- model02 提供試算介面：選目標金額、輸入模擬張數，顯示每張卡的 3 個
  幸運號碼、10 個號碼格（含紅包格）、5 個 play3 格
- 機率表資料忠實保留原始 `.pkl` 內容，消費邏輯忠實移植（含上述兩個
  已知設計，清楚標註）
- 純模擬運算，不扣款、不派彩、不寫入任何玩家帳務資料

## 範圍

- 包含：
  - `server/services/game/scratch/model02Data.ts`（機率表資料，從
    `.pkl` 轉出）
  - `server/services/game/scratch/model02.ts`（消費邏輯：抽卡／幸運號碼
    配對／紅包加碼／play3 開獎）
  - `server/api/admin/game-simulator/scratch-model02.post.ts`（試算
    API，純運算、不碰 `Storage`）
  - `app/components/admin/ScratchModel02Card.vue`（卡片視覺還原）
  - `app/pages/admin/game-simulator.vue`（改成 model02／model03 tabs
    結構，不是各自獨立頁面）
  - `app/services/api.ts`（新增 `admin.gameSimulator.scratchModel02()`
    與對應型別）
  - `test/test-scratch-model02.mjs`（機率表消費邏輯一致性測試）
- 不包含：
  - 不做其餘 7 個 model（model07 無素材、01/05 最複雜，留待之後視需要
    一款一款擴充）
  - 不把刮刮樂做成玩家可玩的真實遊戲（不碰 `Storage`、不接錢包經濟迴圈）

## 影響面

- 後端 API/Services：新增 `server/services/game/scratch/model02*`、新增
  一支 admin API
- 前端元件/頁面：新增 `ScratchModel02Card.vue`；改寫
  `app/pages/admin/game-simulator.vue` 的結構（原本單一 model03 畫面，
  改成 model02／model03 可切換的 tabs），**不影響 model03 既有功能**
  （已用 Playwright 回歸確認）
- 設定或常數：新增 `model02Data.ts`（機率表資料）

## 風險與對策

- 技術風險：
  - 風險：model02 的卡片底圖（`AV_model02_2.jpg`）是一整片沒有分格
    標記的紅包形狀剪影，不像 model03 的底圖事先印好每格的圓圈輪廓，
    沒有「正確答案」可以用 OpenCV 精確量測比對版面座標
  - 對策：版面座標直接沿用原始碼 `get_scratch_card.py` 的
    `get_model02_plist()`，逐行比對確認座標與增量完全一致；在元件
    檔頭註解清楚標註這個範圍限制
  - 風險：裝飾用格子的隨機金額可能抽到大面額（最大 3,000,000，對應
    素材寬達 106px），但格子欄距只有 70px，視覺上會重疊
  - 對策：確認這個重疊是原始設計本身的既有瑕疵（逐行比對過
    `get_model02_plist()` 座標邏輯完全一致，不是這次移植的座標算錯），
    跟使用者確認後**忠實保留、不做偏離原始行為的字體縮放或面額排除**，
    已在元件檔頭註解清楚標註
- UI/UX 風險：
  - 風險：頁面結構改成 tabs 可能影響 model03 既有功能
  - 對策：Playwright 回歸驗證 model03 分頁行為不變、渲染正常

## 驗證方式

- 功能驗證：
  - 直接呼叫 API 驗證：不合法目標金額拒絕、張數上限/下限夾擠正確
  - 30 張卡樣本內驗證：幸運號碼配對中獎判定、紅包格必中、play3 加總
    正確、目標金額 0 的邊界情況全無中獎
  - Playwright 開 `/admin/game-simulator`，切換 model02／model03 兩個
    分頁分別試算，確認畫面渲染正確、無 console 錯誤
- 回歸驗證：`npm test`（39 支測試腳本，含新增的
  `test:scratch-model02`）全數通過

## 成功標準

- [x] `/admin/game-simulator` 可以切換並實際試算 model02／model03
- [x] 機率表消費邏輯忠實移植，含已知的兩個設計細節，已清楚標註
- [x] 無新增重大 console / runtime error
- [x] 相關測試驗證完成，model03 既有功能無回歸
