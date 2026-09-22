# Engineering Evidence

## 變更摘要

- 對應變更：`add-npc-auto-play` — 後台 NPC 自動遊玩
- 變更檔案清單：
  - `server/services/admin/modules/npcAutoPlay.ts`（新增，核心 service）
  - `server/services/admin/modules/npcBgPayload.ts`（新增，15 款 BG 盤口最小合法下注
    payload builder）
  - `server/services/admin/hfyyManage.ts`（修改，掛上 `npcAutoPlay`，`circle()` 呼叫
    `tick()`）
  - `server/api/admin/npc/settings.get.ts`（新增）
  - `server/api/admin/npc/settings.patch.ts`（新增）
  - `server/api/admin/npc/members/[userId]/settings.patch.ts`（新增）
  - `server/api/admin/npc/members/[userId]/games/[category]/[key].put.ts`（新增，取代
    已刪除的全域版 `server/api/admin/npc/games/[category]/[key].put.ts`，見 tasks.md
    「與原規劃的差異」）
  - `server/api/admin/npc/members/[userId]/games/bulk.put.ts`（新增，快捷全選/清空）
  - `server/api/admin/members.post.ts`（既有，重用作為「新增 NPC 會員」的後端端點，
    未修改）
  - `server/api/admin/reports/fcoin-summary.get.ts`（修改，加上 NPC／真人分流）
  - `server/api/admin/reports/bg-summary.get.ts`（修改，加上 NPC／真人分流）
  - `server/api/admin/reports/tw-lottery-payout.get.ts`（修改，加上 NPC／真人分流）
  - `server/api/admin/reports/members.get.ts`（修改，加上 NPC／真人分流）
  - `app/services/api.ts`（修改，新增 NPC 相關型別與 `api.admin.npc.*`，並擴充四份
    報表既有型別加上 `npc` 欄位）
  - `app/components/admin/NpcPanel.vue`（新增，NPC 子頁面本體）
  - `app/pages/admin/npc.vue`（新增，獨立路由頁面，掛載 `NpcPanel`；原第一版是掛在
    `roles.vue` 內的 section，使用者後續自建此頁面後要求搬過去，見 tasks.md「與原規劃
    的差異」）
  - `app/components/admin/Shell.vue`（修改，`active` prop 型別加上 `'npc'`；頂部導覽
    `NAV` 的 `/admin/npc` 項目由使用者自行加入）
  - `app/components/admin/RolesPageNav.vue`（修改，NPC 錨點先加後移除，目前狀態為未改）
  - `app/pages/admin/roles.vue`（修改，NPC section 先加後移除，目前狀態為未改）
  - `app/pages/admin/reports/fcoin.vue`（修改，加上 NPC KPI 卡）
  - `app/pages/admin/reports/settlement.vue`（修改，加上 NPC KPI 卡）
  - `app/pages/admin/reports/plays.vue`（修改，section head 加上 NPC 銷售額提示）
  - `app/pages/admin/reports/members.vue`（修改，section head 加上 NPC 人數提示）
  - `openspec/changes/add-npc-auto-play/{proposal,design,tasks}.md`（規劃階段既有，
    本次補齊 `validation.md`／`engineering-evidence.md`）
- Commit / PR 参考：規劃階段文件已於 `c59420e` commit；本次實作尚未 commit
  （待使用者確認後再建立）

## 驗證佐證

- 對應 `validation.md` 結論：有條件通過（見該檔「結論」段已知限制）
- 佐證附件（截圖 / log / 測試輸出）：無截圖，驗證過程為透過 curl 直接呼叫 API 並比對
  回應 JSON，關鍵數據已整理進 `validation.md`「功能驗證」各項的「實際結果」文字內：
  - 貪吃蛇自動遊玩：11 筆 `game-reward +300 coin` 紀錄（經 `GET
    /api/admin/games/history?userId=...` 確認）
  - LHC-CD 自動下注：`bg-summary` 月報顯示 28 筆訂單／銷售 2509，其中 NPC 佔 25 筆／2209
  - 每日花費上限：乾淨 dev server 重測後，`dailyMaxSpend:50` 情境下僅下注一次（89
    coin）即正確停止，14 秒內未再變動

## 風險與後續追蹤

- 已知風險：
  - 背景排程狀態為模組層級單例（非持久化），dev 環境長時間熱重載可能疊加殘留計時器
    （本次驗證實際遇到，重啟即恢復正常；production build 無此風險，見 `validation.md`）
  - `npcBgPayload.ts` 的下注邏輯直接呼叫 `Storage.games[key].playBets(payload, user)`，
    **未複製** `server/api/lottery/bet.post.ts` 對 `roleGamePerms.isEnabled` 的角色/
    遊戲總閘檢查——真人玩家下注會被這道閘擋下的情境，NPC 目前不受限（例如即使後台
    「遊戲總閘」關閉某盤口，NPC 仍可能透過 `npcAutoPlay` 自己的「勾選清單」照樣下注）。
    這是實作階段發現、proposal/design 未預期到的落差，本次未修正（不影響本次已驗證
    的核心功能），建議之後開新變更補上這道檢查或明確記錄為設計選擇
  - 自動儲值、換日重置兩項行為僅通過程式碼審查，未實際觸發驗證（見 `validation.md`）
- 後續追蹤事項（Open Questions 延伸）：
  - 是否要讓 NPC 下注也遵守 `roleGamePerms.isEnabled` 總閘（見上方風險）
  - `taiwan-lottery.vue` 報表頁面重新加回時，直接串接已備妥的 `summary.npc`
  - 有機會補測自動儲值／跨日重置兩項情境

## 封存前檢查

- [x] validation.md 已完成，結論為「有條件通過」（非「通過」，見已知限制）
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認可正常啟動並完成上述手動驗證
- [ ] 可執行 `openspec archive` — 待使用者確認是否要在「有條件通過」狀態下封存，或
      先處理已知風險（尤其是 NPC 下注繞過 `roleGamePerms` 總閘這項）
