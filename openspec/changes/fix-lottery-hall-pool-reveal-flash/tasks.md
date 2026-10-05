# Tasks

## 1. 問題確認

- [x] 確認 `lottery-hall.vue` 的 `onMounted` 仍是「重置成 0 → 爬回去」的舊版
      邏輯，未被先前任何改動動到
- [x] 確認 SPA 導覽（`lazy:true`）情境下，`watch(initialPools, ...)` 只有
      直接賦值分支，完全沒有動畫

## 2. 第一版修正：起跑百分比 0%→90~95%

- [x] 新增 `mounted` ref，`watch(initialPools, ...)` 依 `mounted.value`
      分流：mount 前直接賦值（避免 hydration mismatch／SSR 無 RAF 環境噴錯），
      mount 後對「第一次出現的 key」套用揭示動畫
- [x] `onMounted` 的重置目標從 `0` 改成 `target * (0.9 + Math.random()*0.05)`
- [x] Playwright 驗證視覺效果：SSR 值 → 爬升到接近目標的起點 → 平滑回到目標
      值，無歸零閃爍、無 hydration mismatch
- [x] 效能重新量測：settled 時間中位數仍 ~4483~4486ms，幾乎沒有改善

## 3. 深入追查 settled 時間沒有改善的原因

- [x] 寫除錯腳本（固定次數取樣，不依賴「連續 300ms 不變」提早中止）直接觀察
      動畫數值序列，確認完整爬升過程接近 4 秒，排除「量測工具誤判」以外的
      其他假設
- [x] 推算 ease-out 三次方曲線尾段收斂到整數顯示穩定所需時間，確認跟起跑
      百分比關係不大，主要取決於曲線形狀本身
- [x] 決定採用「額外縮短揭示動畫時長」而非
      只誠實記錄現狀

## 4. 第二版修正：新增專用的短揭示動畫時長

- [x] `_animatePoolTo` 簽名加上可選的 `durationMs` 參數（預設
      `POOL_ANIM_MS = 4000`）
- [x] 新增 `POOL_REVEAL_ANIM_MS = 800`，兩個揭示呼叫點（`onMounted`、
      `watch(initialPools,...)` 的 lazy 分支）改傳這個較短時長；10 秒輪詢的
      `_fetchPools` 呼叫維持省略參數、用預設的 4000ms
- [x] 效能重新量測：settled 時間中位數降到 1298ms，最大值從 ~4550ms 降到
      ~1993ms，不再有 4 秒尾巴

## 5. 回歸驗證

- [x] `npm test`（36 支既有測試腳本）：本次改動只涉及
      `app/pages/lottery-hall.vue`，與任何遊戲伺服端邏輯無關；執行過程中
      出現的 `m539`／`m649`／`p3` 失敗確認是本次工作階段反覆執行測試腳本把
      真實 `currentIssue` 下注配額打滿所致，與本次變更無關（同一症狀已在
      `fix-admin-guard-hydration-duplicate-fetch` 記錄過一次）
- [x] 清除暫存診斷腳本

## 6. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/fix-lottery-hall-pool-reveal-flash.md`
- [x] `docs/Engineering Evidence/ssr-performance-log.md` 追加兩列（兩版修正
      各一列，誠實記錄「只改起跑百分比沒有解決 settled 時間問題」與「額外
      縮短動畫時長才真正解決」的完整過程）

## 7. 實機觀察：800ms 版本跳動感幾乎消失

- [x] 在瀏覽器直接觀察發現：800ms + 起跑 90~95% 的版本「肉眼幾乎感覺
      不到數字在跳動」
- [x] 自動化腳本複測確認動畫技術上確實有在跑，排除程式碼邏輯壞掉；匿名/
      已登入狀態皆一致，排除權限狀態造成差異
- [x] 決定採用「拉長到 2 秒、起跑改 80~90%」
- [x] `POOL_REVEAL_ANIM_MS` 從 800ms 調整為 2000ms；起跑百分比從 90~95%
      調整為 80~90%（`onMounted` 與 `watch(initialPools,...)` 的 lazy 分支
      兩處都要一起改）
- [x] Playwright 取樣驗證：數字會明顯下探（約 9.5%）再花約 2 秒爬回目標值，
      跳動感清楚可見
- [x] 效能重新量測：settled 中位數 2513.5ms，分布穩定集中（9/10 落在
      2476~2632ms），不再有雙峰分布
- [x] `npm test` 回歸：33/36，`m539`／`m649`／`p3` 確認與本次改動無關
- [x] 追加更新 `validation.md`／`docs/Engineering Evidence/*.md`／
      `ssr-performance-log.md`
