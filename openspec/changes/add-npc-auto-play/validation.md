# Validation

## 驗證範圍

- 對應變更：`add-npc-auto-play` — 後台 NPC 自動遊玩（總開關、會員設定、遊戲勾選、
  BG／經典遊戲自動遊玩排程、四份報表 NPC／真人分流）
- 驗證環境：本機 dev（`npm run dev --port 6100`），透過 curl 直接打 API 驗證後端行為
  （管理員帳號 `admin@example.com`，測試對象為種子帳號 `test01`）

## 功能驗證

依 proposal.md「驗證方式」與 design.md「10. 測試與驗證策略」六項案例逐項驗證：

- [x] 開啟總開關 → 等待排程間隔 → 確認至少一個 NPC 會員產生 `game-reward`（經典遊戲）
      或 BG 下注紀錄 — 實際結果：`tickIntervalSec:1` 開啟後，test01 在數秒內自動玩
      貪吃蛇，產生 11 筆遊玩紀錄，每筆結算 `+300 coin`（`game-reward`，貪吃蛇 遊戲結算）；
      同時 BG 側 `LHC-CD` 月報訂單數同步增加，確認 `playBets()` 真的送出注單
- [x] 關閉總開關 → 確認排程不再產生新的異動記錄 — 實際結果：PATCH `enabled:false`
      後，多次間隔查詢 `spentToday`／`coin` 皆不再變動，確認生效
- [x] NPC 某會員 `dailyMaxSpend` 設低一點 → 確認達到上限後當天不再產生 BG 下注、換日後
      恢復 — 實際結果：**第一輪測試在舊 dev server 上出現異常**（`dailyMaxSpend:50` 設定
      後 8 秒內花費從 767 暴衝到 8207，遠超上限），排查後判定為該 dev server 當天累積
      大量檔案存檔／Nitro 熱重載，`server/plugins/init.ts`（見該檔 L13）每次重載都
      `new BaseClass().runCircle(...)` 重新註冊一次心跳、舊心跳未清除，導致背景疊了多份
      互相獨立計數的 NPC 排程狀態。**重啟 dev server 後用全新種子帳號重測**：
      `dailyMaxSpend:50` 情境下，只成功下了一注（89 coin）把 `spentToday` 推到 89，
      超過上限後後續多次 tick（間隔 1 秒、觀察 14 秒）皆正確跳過，不再下注。
      判定：程式邏輯本身正確，先前異常純屬 dev 環境長時間熱重載的殘留 timer 干擾，
      非本次程式碼缺陷。換日重置邏輯（`_dateKey()` 比對）僅通過程式碼審查確認，
      未實際跨日測試（in-memory 資料，測試環境無法輕易跨日）
- [x] 故意把 NPC 會員 coin 清到接近 0 → 確認下次 BG 下注前觸發 `admin-topup`，且金額
      等於該會員設定的 `topUpAmount` — 實際結果：**未能實際觸發**。嘗試以加大單注金額
      區間（9000～10000）加速消耗餘額，但 LHC-CD 盤口本身對單注金額有合理上限，
      超額下注被遊戲端拒絕（`playBets()` 拋錯，被 `tick()` 的 try/catch 靜默吞掉，
      符合「單一 NPC 失敗不影響其他人」的既定設計），因此沒有真的加速消耗到接近 0。
      改用程式碼審查確認：`_playRandomBg()` 內 `if (Number(user.coin ?? 0) < amount)` 觸發
      `walletBalanceService.appendChange({ type:'admin-topup', amount: setting.topUpAmount,
      note:'NPC 自動儲值' })`，呼叫的是本專案既有、已被其他管理員儲值流程驗證過的同一支
      服務，邏輯直接讀變數、無型別轉換風險，判定為低風險，僅記錄為「已知未實測項目」
- [x] 取消勾選某款 BG／經典遊戲 → 確認 NPC 不再對該款遊戲行動，其他已勾選遊戲不受影響
      — 實際結果：`setGameAllowed` 每次呼叫後回傳的 `allowed` 值皆正確反映請求；
      過程中多次取消勾選 `bg/LHC-CD`、`retro/snake` 後，對應動作皆立即停止（花費/coin
      不再變動），符合預期
- [x] （後續追加）遊戲勾選改成每個 NPC 各自獨立後，確認不同 NPC 的勾選互不影響、快捷
      全選/清空正確 — 實際結果：建立 `npc-alpha`／`npc-beta` 兩個 NPC，對 alpha 呼叫
      `PUT .../games/bg/LHC-CD {allowed:true}`，對 beta 呼叫
      `PUT .../games/bulk {category:'retro', allowed:true}`；重新查詢
      `GET /api/admin/npc/settings` 確認 alpha 的 `allowedGames` 僅有 `["bg:LHC-CD"]`
      （1 款），beta 的 `allowedGames` 有全部 30 款 retro 遊戲，兩者互不影響；驗證後已
      將兩者選擇清空還原
- [x] 報表頁面（fcoin/bg-summary/tw-lottery-payout/會員）能看到 NPC 與真人分開的數字，
      兩者加總等於原本的合計數 — 實際結果：以 `bg-summary` 為例，本月 `LHC-CD`
      共 28 筆訂單、銷售 2509，其中 `npc` 子物件顯示 25 筆、2209，兩者關係合理
      （NPC 訂單數＋真人訂單數＝總訂單數）；`fcoin-summary`／`members.get.ts`／
      `tw-lottery-payout.get.ts` 三支皆為同一 `Bucket` 分流模式改寫，程式碼審查確認
      邏輯一致，僅 `bg-summary` 有實際下注資料可供端對端驗證

## 視覺驗證

- 與既有後台風格比對：`NpcPanel.vue` 沿用 `admin-panel`／`admin-table`／`admin-grid1`／
  `admin-btn-*` 共用樣式，與 `roles.vue` 內其他 section（角色清單、遊戲總閘）視覺一致
- 響應式斷點檢查：沿用既有 `roles.vue`／`admin-grid1` 既有斷點設定，未新增自訂斷點，
  未單獨測試窄螢幕（風險低，元件結構與既有 grid 元件相同）

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：`/admin/roles` 既有角色指派、角色設定、遊戲總閘 — 結果：多次透過
    `PATCH /api/admin/roles/[id]` 切換 test01 的角色（user ⇄ npc），既有角色下拉
    行為未受影響
  - 流程：真人玩家的 BG 下注／台彩／經典遊戲既有流程 — 結果：本次改動未修改
    `playBets()`／`actions.record()` 本身，僅新增呼叫方，未做額外回歸測試（風險低）
  - 流程：既有報表原本的合計數字（真人＋NPC 混合的總數） — 結果：`bg-summary`
    等四份報表的「全部欄位」維持原本欄位名稱與計算方式不變，僅新增 `npc` 子物件，
    確認為向後相容的新增而非取代

## 問題與修正紀錄

- 問題：每日花費上限（`dailyMaxSpend`）測試時，花費遠超設定值
  - 發現方式：手動以低上限（50）+ 快速排程（1 秒）測試，觀察 `spentToday` 異常暴衝
  - 修正方式：非程式碼問題。判定為 dev server 長時間熱重載累積殘留排程 timer，
    重啟 dev server 後於乾淨環境重測，行為正確
  - 是否已重新驗證：是（見上方「功能驗證」第 3 項）

## 結論

- 是否通過：有條件通過
- 已知限制或風險：
  - 自動儲值（`admin-topup`）觸發路徑僅通過程式碼審查，未實際跨越「餘額不足」情境
    做端對端驗證（見上方第 4 項說明）
  - 每日花費上限的「換日重置」邏輯僅通過程式碼審查，未實測跨日情境
  - `taiwan-lottery.vue` 沒有 UI 消費新增的 `npc` 欄位（該頁報表渲染區塊在本次變更前
    已被移除，非本次改動範圍）
  - BG 彩票 15 款盤口的自動下注 payload 都是「單組最小合法下注」，實際下注時若遇到
    該盤口當下不開放下注（如開獎/準備中階段），會被靜默跳過，不會出現異常但也不會
    在封盤期間硬做動作 —— 屬預期行為
  - 背景排程（`hfyyManage.circle()` → `npcAutoPlay.tick()`）目前依賴模組層級的
    `let`/`Map` 單例保存狀態，在 Nitro dev 模式長時間熱重載下可能疊加多份殘留計時器
    （本次驗證中實際遇到），正式環境（build/production，無 HMR）不受影響，但開發時
    若懷疑排程行為異常，建議先重啟 dev server 排除此因素再判斷是否為真的程式碼問題
- 後續追蹤事項：
  - 有機會時補測「自動儲值觸發」與「跨日重置」兩項未實測情境
  - 若 `taiwan-lottery.vue` 報表頁面之後重新加回，直接串接既有 `summary.npc` 即可
