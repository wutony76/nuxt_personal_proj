# Design

## 問題拆解

`watch(initialPools, (next) => {...}, { immediate: true })` 在 SSR／hydration
當下（`mounted.value` 為 false）把真實值直接賦進 `displayPools`，確保 SSR 輸出
的 HTML 跟 client 初次渲染的 DOM 完全一致，不產生 hydration mismatch。這部分
邏輯保持不變。

問題出在 mount 之後要怎麼「補一個視覺效果」：

1. **舊版（reset to 0）**：`onMounted` 把已經正確的值記下來、重置成 0、再用
   `_animatePoolTo` 爬回去。實際看到的是「正確數字先消失再爬回來」，體感
   是資料被捨棄重算
2. **lazy 到達分支完全沒有處理**：`watch(initialPools, ...)` 只有
   `!mounted.value` 這個分支做賦值，`mounted.value` 為 true 時（lazy 資料在
   mount 之後才到）沒有對應的動畫邏輯，數字直接賦值顯示，跟情境 1 的動畫風格
   不一致

## 決策 1：統一在「資料第一次出現」時做揭示動畫，不分全頁載入／SPA 導覽

與其讓 `onMounted`（處理「mount 之前資料已就緒」的情況）和
`watch(initialPools, ...)` 的 lazy 分支（處理「mount 之後資料才到」的情況）
各自維護一套邏輯，統一用同一個「揭示」概念：

- `onMounted`：對「mount 當下 `displayPools` 已經有值」的 key，做一次性的
  揭示動畫（這些 key 必然是 SSR／hydration 階段賦值進來的）
- `watch(initialPools, ...)` 的 lazy 分支：對「這個 key 目前不在
  `displayPools` 裡」（代表這是這個 key 第一次拿到值，發生在 mount 之後）
  做一樣的揭示動畫；如果 key 已經在 `displayPools` 裡（理論上不會發生在
  `lazy:true` + 單次 resolve 的情境，但保留作為防呆），退回一般
  `_animatePoolTo` 平滑過渡，不重新揭示

兩邊用同一組「從目標值 90%~95%（隨機取一個比例，避免每張卡片動作完全同步）
開始、動畫爬升到目標值」的視覺語言，體感一致。

## 決策 2：揭示動畫要用更短的專用時長，不能沿用 `POOL_ANIM_MS`

只改起跑百分比（0%→90~95%）之後，用 `test/perf-ssr-lottery-hall.mjs` 重新
量測，settled 時間中位數仍落在 ~4483~4486ms，幾乎沒有變化。用獨立的除錯腳本
（固定次數取樣，不依賴「連續 300ms 不變」提早中止）直接觀察動畫數值序列，
確認整個爬升過程完整跑了接近 4 秒，不是量測工具的問題。

推算原因：ease-out 三次方曲線 `ease = 1 - (1-t)^3`，要讓顯示值（四捨五入到
整數）停止變動，需要剩餘誤差 `(1-ease) * diff < 0.5`。對於彩池這種數百萬級的
金額，就算 `diff` 只是目標值的 5%~10%（仍是數十萬的絕對量級），解
`(1-t)^3 < 0.5/diff` 得到的 `t` 都非常接近 1（約 0.96~0.985），對應時間都
接近完整的 4000ms——**起跑點離目標值有多近，對「視覺何時真正停止變動」幾乎
沒有影響，因為決定性因素是曲線尾段的斜率，不是絕對差值的大小**。

因此額外新增 `POOL_REVEAL_ANIM_MS = 800`，只用在「揭示」這兩個呼叫點；10 秒
輪詢的 `_fetchPools` 仍呼叫 `_animatePoolTo(key, value)`（省略第三參數，用
預設的 `POOL_ANIM_MS = 4000`）——那是真實資料變化，值得從容跑完，不需要跟著
縮短。

`_animatePoolTo` 簽名改成 `(key, target, durationMs = POOL_ANIM_MS)`，呼叫端
視情境傳入不同時長，不新增另一個函式。

## 決策 3：量測方法論本身的已知弱點

在第一輪量測（只改起跑百分比）時觀察到「4 次快（~260ms）、4 次慢
（~4480ms）」的乾淨切分，一度懷疑是新邏輯本身的 race condition。用固定次數
取樣的除錯腳本重現同一組情境 4 次，結果 4 次都是完整的 ~4 秒爬升，沒有重現
「快」的情況——證實這是量測腳本「連續 300ms 文字不變視為 settled」這個判定
邏輯本身的弱點：如果測試的第一次 polling 剛好卡在 `onMounted` 真正把顯示值
重置成 90~95% 之前（`onMounted` 的執行時機本身有 Vue 排程 + 瀏覽器事件迴圈
的不確定性），會先看到「SSR 原始值維持不變」兩三次 poll，提早判定為
settled、`break` 出迴圈，之後真正的揭示動畫完全沒有被採樣到。這不是本次
改動新引入的問題（舊版 reset-to-0 的動畫一樣有這個理論風險，只是從 0 開始的
巨大落差幾乎不可能被誤判成「沒有變化」），而是量測方法論本身在「揭示動畫
啟動時機」這塊的已知侷限，記錄下來但不在本次範圍內修正量測腳本本身。
