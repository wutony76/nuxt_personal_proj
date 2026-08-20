## Why

大廳目前缺少「快樂十分」（KL10）玩法。玩法來源專案 `bglottery` 的
`src/components/room/lotteryAll/kl10/`（`playTabId` 13210~13213）**只有信用模式、沒有官方盤**
（該資料夾下沒有 `official/` 子目錄，與 11x5／ssc／pk10／k3 的雙盤口不同），
架構條件與 PC蛋蛋（EGGS）完全相同 —— 單一盤口、單一頁面、單一結算入口、單一爆池，
可直接複用 EGGS 那一套分層（config → server service → composable → components → page），
並沿用 11選5（X5）的「多球位＋龍虎＋集合性質總和」機率推導慣例。

## What Changes

- 新增 `shared/config/kl10.ts`（機率核心：8 球取自 1~20 不重複；單球邊際分布母數 20、
  集合性質母數 C(20,8)=125,970）與 `shared/config/kl10cd/`（看板設定 `plays.js` + 讀取層 `helpers.ts`）、
  `shared/config/kl10-cd.ts`（注碼判定、賠率推導、爆池設定）。
- 新增 `server/services/game/lottery/bg/kl10.ts`：單一信用盤 service（比照 `eggs.ts`，
  **不建立** `kl10Shared.ts`／官方盤，因來源本身只有信用模式）。
- 新增 5 支 API：`server/api/lottery/kl10/{current,claim,user-record,opencode-history,jackpot}`，
  投注沿用共用路由 `/api/lottery/bet`。
- 新增 `app/composables/useKl10.ts`（比照 `useEggs.ts`，額外處理「任選」的複式組合展開）。
- 新增 `app/components/lottery/bg/kl10/**`（版面骨架比照 `eggs/**`；多一支 `base/BoardRenxuan.vue`
  處理任選的號碼池選號，因為那是唯一「一注多碼」的玩法）。
- 新增 `app/pages/lottery/bg/kl10.vue`（單頁，無盤口切換）。
- `app/config/constants.js` 新增 `LOTTERY.KL10`；`server/services/storage.ts` 註冊實例；
  `lottery-hall.vue`／`BgAutoPanel.vue`／`useBgAutoActive.ts` 掛上入口與自動下注面板；新增對應 SCSS。
- 玩法規則（4 個分頁、來源逐項對照，判定依據詳見 `design.md`）：
  - 正和（1-8球，13210）：每球「單碼 01~20」＋「兩面 大/小/單/雙/合單/合雙/尾大/尾小」
  - 龍虎鬥（13211）：8 球兩兩比大小共 C(8,2)=28 組，各「龍／虎」（無和局 —— 8 球互不重複）
  - 任選（13212）：任一中一 ~ 任五中五，號碼池 01~20，複式以組合展開成多注
  - 兩面（13213）：8 球總和 大/小/單/雙/尾大/尾小 ＋ 上下盤（上/和/下）＋ 奇偶盤（奇/和/偶）
- 爆池：接上既有泛用骨架 `shared/config/jackpot.ts`（不新發明），觸發條件為
  **「8 個開獎號中奇數 ≥7 個或偶數 ≥7 個」**（2,490/125,970 ≈ 1.9767%，使用者拍板）。

## Capabilities

### New Capabilities
- `kl10-credit`: 快樂十分信用盤玩法頁需提供正和／龍虎鬥／任選／兩面四大類玩法、
  單一頁面下注與結算、以及與玩法正確關聯的爆池分配能力。

### Modified Capabilities
- （無）

## Impact

- 前端：新增 `app/pages/lottery/bg/kl10.vue`、`app/components/lottery/bg/kl10/**`、`app/composables/useKl10.ts`
- Config：新增 `shared/config/kl10.ts`、`shared/config/kl10-cd.ts`、`shared/config/kl10cd/{plays.js,helpers.ts}`
- 後端：新增 `server/services/game/lottery/bg/kl10.ts`、`server/api/lottery/kl10/**`；修改 `server/services/storage.ts`
- 共用設定：修改 `app/config/constants.js`、`app/services/api.ts`、`app/pages/lottery-hall.vue`、
  `app/components/lottery/bg/BgAutoPanel.vue`、`app/composables/useBgAutoActive.ts`、SCSS manifest
- 影響範圍：僅新增獨立玩法路由與服務，不改動既有 6hc／k3／pk10／ssc／11x5／eggs 的判定與結算邏輯
