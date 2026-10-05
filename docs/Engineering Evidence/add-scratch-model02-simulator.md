# Engineering Evidence：刮刮樂 model02 試算工具

## 變更摘要

- **對應變更**：`add-scratch-model02-simulator`
- **變更檔案**：
  - `server/services/game/scratch/model02Data.ts`（新增，機率表資料）
  - `server/services/game/scratch/model02.ts`（新增，消費邏輯）
  - `server/api/admin/game-simulator/scratch-model02.post.ts`（新增）
  - `app/components/admin/ScratchModel02Card.vue`（新增，卡片視覺還原）
  - `app/pages/admin/game-simulator.vue`（改寫，單一 model03 畫面 →
    model02／model03 tabs 結構）
  - `app/services/api.ts`（新增型別與呼叫）
  - `test/test-scratch-model02.mjs`（新增）
  - `package.json`（新增 `test:scratch-model02`）

### 背景

延續 `add-scratch-model03-simulator` 建立的整合方式，使用者要求「其他的
刮刮樂玩法可以幫我加進來」。先用背景 agent 調查剩餘 8 個 model 的資料
格式／機制／素材複雜度，確認 model02 零 BTrees、素材齊全，是最簡單的，
跟使用者確認後決定一款一款做、從 model02 開始。

### 做法

1. 讀 `scratch_model02.py` 的 `get_coin_card()`／`get_play1()`／
   `analyze_card()`，理解卡片由 play1（幸運號碼配對）＋play2（紅包
   加碼）＋play3（純 5 格開獎）三段機率分數融合而成
2. 確認 `data/model02.pkl` 零 BTrees，原封不動轉成 TypeScript 具名常數
3. 忠實重寫消費邏輯，簡化掉草稿階段多餘的 `winCells` 比對清單——裝飾格
   候選池在建構時已排除幸運號碼本身，中獎判定可以直接用
   `luckSet.has(num)`
4. 刻意保留兩個容易誤解、但原始系統既有的設計：裝飾格金額是純展示值
   （不是派彩）、near-miss（跟幸運號碼差 1 的數字）會被刻意展示但不會
   中獎——跟使用者確認忠實移植，不擅自修正
5. 卡片視覺還原：寫通用版一次性 Python 腳本切出素材，座標直接沿用
   `get_model02_plist()`（逐行比對確認一致），百分比定位（沿用 model03
   學到的教訓）
6. 改寫 `game-simulator.vue` 成 model02／model03 tabs 結構，兩個 model
   各自獨立狀態，互不影響

## 驗證

| 項目 | 方法 | 結果 |
|---|---|---|
| 邏輯一致性 | 獨立 tsx 腳本，9 檔目標金額 × 50 次（450 樣本） | 全數通過：10 格／5 格play3／3 個相異幸運號碼／號碼範圍 |
| API 行為 | `test/test-scratch-model02.mjs`（19 項） | 全數通過：不合法金額拒絕、張數夾擠、30 張卡樣本驗證中獎判定/紅包/play3 一致性 |
| 人工抽樣 | curl 直接呼叫 API 核對 payout 組成 | 確認 yellow 中獎＋紅包＋play3 加總＝目標金額、near-miss 展示正確、紅包替換機制正確消耗候選格 |
| 面板渲染 | Playwright 開 `/admin/game-simulator` | model02／model03 兩分頁皆正常試算渲染，狀態互相獨立，無 console 錯誤 |
| 卡片視覺還原 | Playwright 截圖檢查 | model02 底圖/幸運號碼/號碼格/play3 正確渲染；model03 回歸確認未受影響 |
| 回歸測試 | `npm test` | 39/39（含本次新增腳本） |

### 已知視覺瑕疵：裝飾用大面額數字重疊（忠實保留，非移植錯誤）

Playwright 截圖驗證時發現：10 格裡的裝飾用金額若抽到 3,000,000（對應
素材 `coin_3000000.png` 寬達 106px），會跟只有 70px 欄距的相鄰格重疊。
逐行比對原始碼 `get_scratch_card.py` 的 `get_model02_plist()`，座標起點
與增量完全一致，確認這個重疊是原始設計本身在遇到大面額裝飾數字時就會
有的視覺瑕疵，不是這次移植的座標計算錯誤。

跟使用者確認處理方式，使用者選擇**忠實保留、照原樣**（備選的「縮小
裝飾金額字體」「排除大面額裝飾值」兩個方案都會偏離原始行為，使用者
認為不需要）。卡片視覺下方保留純文字版的號碼格/play3 明細表格，供需要
精確核對數字的情境使用，不受視覺重疊影響。

## 風險與後續

- 已知風險：裝飾用大面額數字重疊——已在 `ScratchModel02Card.vue` 檔頭、
  `design.md`、本文件清楚標註是原始設計既有瑕疵、經使用者確認忠實保留
- 後續追蹤事項：
  - 剩餘 7 個 model（model07 無素材、01/05 最複雜）留待使用者視需要
    一款一款繼續擴充
  - 若之後要做「玩家實際可玩的刮刮樂遊戲」，需要另外設計錢包經濟迴圈
    整合，屬於完全不同範疇的工作

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [x] `npm test` 39/39
- [ ] `openspec archive`
