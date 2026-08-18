## Why

大廳目前缺少「PC蛋蛋」玩法。既有玩法來源專案 `bglottery` 的 `pceggs`（`playTypeId: 1501`）僅提供信用模式（`mode: 2`），無官方盤；本專案已有 K3（信用+官方雙盤口）與 SSC（同上）作為玩法擴充範本，可直接複用其分層架構（config → server service → composable → components → page），縮短導入時間並維持玩法規格一致性。

## What Changes

- 新增 `shared/config/eggs.ts`（機率核心：3 球 0~9、和值 0~27 全窮舉）與 `shared/config/eggscd/`（信用盤看板設定 `plays.js` + 讀取層 `helpers.ts`），玩法名稱／playId／分組直接取自 `bglottery` 的 `pceggs/config_play.js`（正合 `zhengheTraditional`）。
- 新增 `server/services/game/lottery/bg/eggs.ts`：單一信用盤 service（仿 `k3Cd.ts`，**不建立官方盤與 Shared 共用層**，因來源玩法本身只有信用模式）。
- 新增 4 支 API：`server/api/lottery/eggs/{current,claim,user-record,opencode-history}`，投注沿用共用路由 `/api/lottery/bet`。
- 新增 `app/composables/useEggs.ts`（仿 `useK3.ts` 但無 `setMode`/官方盤分支）。
- 新增 `app/components/lottery/bg/eggs/**`（下注面板、Header、History、Road、Report、Dialog* 等，layout 參考 `k3/cd/**`）。
- 新增 `app/pages/lottery/bg/egg.vue`（單頁，無 cd/of 分頁）。
- `app/config/constants.js` 新增 `LOTTERY.EGGS`；`server/services/storage.ts` 註冊遊戲實例；`lottery-hall.vue`、`BgAutoPanel.vue`、`useBgAutoActive.ts` 掛上新玩法入口與自動下注面板；新增對應 SCSS。
- 玩法規則（判定邏輯，皆有明確依據，詳見 `design.md`）：
  - 大／小：和值 >13 為大、≤13 為小（`bglottery` `header.vue` genClass 邏輯）
  - 单／双：和值奇偶
  - 极大／极小：和值 22~27 / 0~5（使用者已確認門檻，因所有可查來源均未定義此規則）
  - 大单／小单／大双／小双：大小 × 单双 的組合判定
  - 红波／蓝波／绿波：和值對應 `bglottery` `dict.js` 四色表
  - 豹子／对子／顺子：沿用本專案 `shared/config/ssc.ts` 既有的三球（0~9）牌型判定慣例（豹子＝三數相同、对子＝恰兩數相同、顺子＝三數連號不含環狀）
  - 特码：和值 0~27 直選

## Capabilities

### New Capabilities
- `pceggs-credit`: PC蛋蛋信用盤玩法頁需提供大小單雙／極值／色波／特殊玩法（豹子對子順子）／特碼共 5 大類、單一頁面下注與結算能力。

### Modified Capabilities
- （無）

## Impact

- 前端：新增 `app/pages/lottery/bg/egg.vue`、`app/components/lottery/bg/eggs/**`、`app/composables/useEggs.ts`
- Config：新增 `shared/config/eggs.ts`、`shared/config/eggscd/plays.js`、`shared/config/eggscd/helpers.ts`
- 後端：新增 `server/services/game/lottery/bg/eggs.ts`、`server/api/lottery/eggs/**`；修改 `server/services/storage.ts`
- 共用設定：修改 `app/config/constants.js`、`app/pages/lottery-hall.vue`、`app/components/lottery/bg/BgAutoPanel.vue`、`app/composables/useBgAutoActive.ts`、`app/assets/style/base.scss`（新增 `lhc_eggs.scss` 之類）
- 影響範圍：僅新增獨立玩法路由與服務，不改動既有 6hc／k3／pk10／ssc 邏輯
