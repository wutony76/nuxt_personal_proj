# Tasks

> 規劃階段產出。5 項待確認事項已由使用者拍板（見 proposal.md「已決定事項」），仍全部
> 尚未開始實作。

## 0. 待確認事項（已拍板，僅剩「建議預設值」需使用者最終確認）

- [x] NPC 資金來源：雙軌（會員 `dailyMaxSpend`/`topUpAmount` + 經典遊戲賺分數換 F幣）
- [x] NPC 下注混進真人資料，但報表要分流顯示
- [x] 第一階段遊戲範圍：BG 彩票 + 經典遊戲全部，TW/toys 先列清單標記即將支援
- [x] 「建議預設值」表格（見 proposal.md）使用者最終確認或調整（`dailyMaxSpend` 50,000、
      BG 單注隨機範圍 10～150）
- [x] 總開關關閉：進行中的動作做完才停，不強制中斷

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/已決定事項/建議預設值）
- [x] 完成 design 定稿（state/flow/API/排程與經濟迴圈設計/報表分流設計）
- [x] 使用者確認「建議預設值」
- [ ] 使用者明確下指令進入 Implementation

## 2. 後端 Service 與資料模型（Implementation 階段）

- [ ] 新增 `server/services/admin/modules/npcAutoPlay.ts`：
      總開關、排程參數（`tickIntervalSec`/`bgWeight`/`retroWeight`/`retroScoreMinPct`/
      `retroScoreMaxPct`/`bgBetAmountMin`/`bgBetAmountMax`）、四分類遊戲清單（bg/retro 可勾選，tw/toys 標記
      `supported:false`）、per-NPC 會員設定（`dailyMaxSpend`/`topUpAmount`）、今日已花費
      追蹤（跨日重置）、`tick()`
- [ ] `server/services/admin/hfyyManage.ts` 掛上 `npcAutoPlay`，`circle()` 呼叫 `tick()`
- [ ] BG 彩票 15 款盤口的最小合法下注 payload：逐一對照各盤口既有驗證邏輯，先打通 1～2
      款，其餘依序補齊（列出各盤口小任務，實作階段展開）：
  - [ ] LHC-CD／LHC-OF
  - [ ] K3-CD／K3-OF
  - [ ] PK10-CD／PK10-OF
  - [ ] SSC-CD／SSC-OF
  - [ ] X5-CD／X5-OF
  - [ ] EGGS
  - [ ] KL10／KL8
  - [ ] FC3D／PL3
- [ ] 經典遊戲 29 款：確認 `maxReasonableScore()` 對每款都有合理實作（用既有函式，非
      新增），模擬分數 × `coinRate` 產生的 `game-reward` 走既有 `settleReward()` 結算

## 3. 後端 API

- [ ] `server/api/admin/npc/settings.get.ts`
- [ ] `server/api/admin/npc/settings.patch.ts`
- [ ] `server/api/admin/npc/games/[category]/[key].put.ts`
- [ ] `server/api/admin/npc/members/[userId]/settings.patch.ts`
- [ ] `server/api/admin/reports/fcoin-summary.get.ts` 加上 NPC／真人分流
- [ ] `server/api/admin/reports/bg-summary.get.ts` 加上 NPC／真人分流
- [ ] `server/api/admin/reports/tw-lottery-payout.get.ts` 加上 NPC／真人分流
- [ ] 會員報表（`members.get.ts`）加上 NPC／真人分流

## 4. 前端 API 與型別

- [ ] `app/services/api.ts` 新增對應型別與 `api.admin.npc.*`

## 5. 前端頁面

- [ ] 新增 `app/components/admin/AdminRolesNav.vue`
- [ ] 新增 `app/pages/admin/npc.vue`（總開關 + 排程參數 + NPC 會員清單/編輯 + 四分類
      遊戲勾選格，tw/toys 顯示但 disabled + 「即將支援」標籤）
- [ ] `app/pages/admin/roles.vue` 補上 `AdminRolesNav`
- [ ] `fcoin.vue`／`settlement.vue`／`plays.vue`／`taiwan-lottery.vue`／`members.vue`
      補上 NPC／真人分流顯示

## 6. 錯誤處理與體驗

- [ ] 總開關／排程參數／會員設定／遊戲勾選各自獨立的 loading/success/error 狀態
- [ ] 排程 `tick()` 每個 NPC、每次行動都 try/catch 包住，單一失敗不中斷其他人

## 7. 視覺與互動驗證

- [ ] 新頁面與既有後台頁面風格一致
- [ ] 手動驗證：見 design.md「10. 測試與驗證策略」六項案例

## 8. 交付檢查（Implementation 完成後）

- [ ] 確認 `npm run dev` 可正常啟動
- [ ] 補齊 `validation.md` 與 `engineering-evidence.md`

## Open Questions（延伸到實作階段）

- （已定案：`bg-lottery.vue` 彩池稽核報表 `poolAudit` 不做 NPC／真人分流，維持現狀）
