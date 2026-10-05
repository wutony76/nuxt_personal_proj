# Proposal

## 變更名稱

fix-lottery-hall-pool-reveal-flash — 修正大廳彩池「首次載入動畫」歸零閃爍與
SPA 導覽無動畫的問題

## 背景

`add-ssr-lottery-hall-pools` 之後，為了保留原本的「數字跳動」視覺體感，在
`onMounted` 補回一段「取得目前正確顯示值 → 重置成 0 → 用 `_animatePoolTo`
爬回去」的邏輯。實機觀察發現兩個問題：

1. SSR 已經給出正確數字，`onMounted` 卻把它瞬間歸零、再花 4 秒爬回來——視覺上
   像是「SSR 資料被捨棄、重新計算」，觀感比完全不做動畫更差
2. `lazy: true` 情境下（從別頁用 client-side 連結導覽進大廳），資料是 mount
   之後才到位的，`onMounted` 當下 `displayPools` 還是空的，完全沒有套用任何
   動畫效果，數字直接憑空出現——跟全頁載入情境的視覺風格不一致

此外，效能紀錄裡沿用舊版量測方式的「settled 226ms」已經不成立：補回動畫之後，
settled 時間實際上又回到接近 4 秒（動畫本身的時長）。

## 目標

- 首次載入／SPA 導覽進入大廳，彩池數字都改成從接近目標值（90%~95%）爬升，不
  再出現「正確數字先消失再爬回來」的歸零閃爍
- SPA 導覽情境（`lazy` 資料延遲抵達）要套用跟全頁載入一致的揭示動畫，不是
  「完全沒有動畫、數字憑空出現」
- 誠實量測並記錄「揭示動畫」對 settled 時間指標的實際影響，不能只改視覺就假設
  數字會變好看

## 範圍

- 包含：
  - `app/pages/lottery-hall.vue`（`onMounted` 的揭示邏輯、
    `watch(initialPools, ...)` 的 lazy 到達分支、`_animatePoolTo` 的動畫時長）
- 不包含：
  - 不改 10 秒輪詢（`_fetchPools`）本身的動畫時長或邏輯，那是真實資料變化，
    維持原本 4000ms 的從容動畫
  - 不改 SSR 資料獲取本身（`useAsyncData('lottery-hall-pools', ...)`）

## 影響面

- 前端路由/頁面：`app/pages/lottery-hall.vue`
- 前端元件/Composables：無
- 後端 API/Services：無

## 風險與對策

- 技術風險：
  - 風險：一開始只改「起跑百分比」（0%→90~95%），實測發現 settled 時間指標
    幾乎沒有變快（ease-out 三次方曲線尾段要到接近滿 4 秒才會讓四捨五入後的
    整數顯示停止變動，這個時間點主要取決於曲線形狀，跟起跑點差距關係不大）
  - 對策：額外新增專用的較短動畫時長（`POOL_REVEAL_ANIM_MS` = 800ms），只用於
    「首次揭示」這兩個呼叫點，10 秒輪詢的真實數字更新仍維持原本 4000ms
  - 風險：揭示動畫必須只在 mount **之後**才套用（不能在 SSR／hydration 當下
    套用），否則 client 初次渲染的值會跟 SSR 渲染的 DOM 不一致，造成
    hydration mismatch；而且 `requestAnimationFrame`／`performance.now()`
    在 SSR 的 Node 環境根本不存在，誤呼叫會直接噴錯
  - 對策：新增 `mounted` ref，`watch(initialPools, ...)` 內依照
    `mounted.value` 分流：mount 之前直接賦值（不動畫），mount 之後才套用揭示
    動畫
- UI/UX 風險：
  - 風險：無——純粹讓動畫體感更接近「資料剛結算完、還在微調」而非「資料不見
    了重算」，範圍內已用 Playwright 直接觀察確認

## 驗證方式

- 功能驗證：
  - Playwright 直接取樣彩池顯示文字，確認全頁載入情境是「SSR 正確值 → 爬升到
    接近目標值的起點 → 平滑回到目標值」，不再出現歸零
  - Playwright 驗證 SPA 導覽情境（從首頁點連結進大廳）也會套用同樣的揭示動畫
  - 確認無 hydration mismatch 相關 console 警告
- 效能驗證：
  - `test/perf-ssr-lottery-hall.mjs` 重新量測 settled 指標，對比「只改起跑
    百分比」與「額外縮短揭示動畫時長」兩個版本
- 回歸驗證：`npm test`（36 支既有測試腳本）全數通過或確認失敗項目與本次變更
  無關

## 成功標準

- [x] 全頁載入與 SPA 導覽兩種情境都不再出現歸零閃爍或完全無動畫的落差
- [x] settled 時間指標的惡化有被誠實量測、追查並盡力收斂（非僅視覺修正）
- [x] 無新增 hydration mismatch 或 runtime error
- [x] 相關測試或手動驗證完成
