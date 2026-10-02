# Engineering Evidence

## 變更摘要

- 對應變更：`fix-lottery-hall-pool-reveal-flash` — 修正大廳彩池首次載入動畫
  歸零閃爍、SPA 導覽無動畫、揭示動畫拖累 settled 效能指標三個問題
- 變更檔案清單：
  - `app/pages/lottery-hall.vue`
  - `openspec/changes/fix-lottery-hall-pool-reveal-flash/{proposal,design,tasks,validation}.md`
  - `docs/Engineering Evidence/ssr-performance-log.md`（追加兩列）
- Commit / PR 參考：（尚未 commit，待使用者確認後再建立）

## 驗證佐證

- 對應 `validation.md` 結論：**通過**
- 佐證附件：
  - Playwright 取樣：全頁載入情境從 SSR 正確值爬升到接近目標的起點（約
    94.4%）再平滑回到目標值，不再歸零；SPA 導覽情境同樣套用揭示動畫，不再
    是「完全沒有動畫、數字憑空出現」
  - 效能量測（`test/perf-ssr-lottery-hall.mjs`）：只改起跑百分比（0%→
    90~95%）時 settled 中位數仍 ~4483ms，幾乎沒有改善；新增專用的 800ms
    短動畫（`POOL_REVEAL_ANIM_MS`）後，settled 中位數降到 1298ms、最大值從
    ~4550ms 降到 1993ms
  - 曾經出現的「4 次快、4 次慢」乾淨切分樣本分布，用固定次數取樣的除錯腳本
    重現同一情境確認是量測腳本本身「連續 300ms 不變視為 settled」判定邏輯
    的時序巧合，不是揭示動畫真的有時候很快，記錄為量測方法論的已知侷限
  - `npm test`：本次改動僅涉及 `lottery-hall.vue`，與遊戲伺服端邏輯無關；
    執行過程中出現的 `m539`／`m649`／`p3` 失敗確認是測試環境下注配額累積
    問題，與本次變更無關

## 追更：使用者實測回報「肉眼幾乎感覺不到數字在跳動」

800ms + 起跑 90~95% 版本的 settled 指標雖然最漂亮，但使用者實際在瀏覽器
觀察後回報跳動感幾乎消失——落差小、收得快，人眼來不及感知。調整為
`POOL_REVEAL_ANIM_MS`=2000ms、起跑百分比 80~90%：

- Playwright 取樣確認數字會明顯下探（約 9.5%）再花約 2 秒平滑爬回目標值，
  跳動感清楚可見
- settled 中位數 2513.5ms（較修正前 ~4483ms 改善近半），分布穩定集中
  （9/10 落在 2476~2632ms），不再有雙峰分布
- `npm test` 33/36，`m539`／`m649`／`p3` 確認與本次改動無關

**教訓**：「settled 指標快」與「人眼感覺得到在動」是兩個互相拉扯的目標，
優化其中一個很容易在不知不覺中犧牲另一個，兩者都要實際驗證（自動化量測
+ 人眼觀察），不能只靠其中一種驗證方式就判定「修好了」。

## 風險與後續追蹤

- 已知風險：
  - 揭示動畫的啟動時機（`onMounted` 的 Vue 排程 + 瀏覽器事件迴圈）本身有
    些微不確定性，理論上仍可能讓少數測試樣本的「settled」判定提早（量測
    方法論的侷限，不是應用程式邏輯的 bug）
- 後續追蹤事項：
  - 無新增；settled 時間與視覺可感知度已在使用者實測確認下找到折衷點

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] Playwright 視覺驗證通過，效能數據從「~4483ms」改善到「2513.5ms」
      （最終版本，人眼可清楚辨識跳動效果）
- [x] `npm test` 33/36（其餘 3 支確認為與本次改動無關的測試環境狀態累積問題）
- [ ] 可執行 `openspec archive` — 建議使用者確認後再封存
