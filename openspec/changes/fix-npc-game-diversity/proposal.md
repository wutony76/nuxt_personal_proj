# Proposal

## 變更名稱

fix-npc-game-diversity — NPC 自動新增時隨機分派玩家原型，差異化各自會玩
哪些遊戲，讓「資料統計／會員」的每款遊戲人數分布更接近真實情況

## 背景

使用者回報：「每個 npc 都是玩全部的遊戲，需要幫我差異化一下，查看資料統計
會員才不會分不太平均，需要符合一下模擬實際的遊戲情況」。

追查 `npcAutoPlay.ts` 發現：`_allowedGamesOf(userId)` 在某個 NPC 第一次被
存取、還沒存過任何勾選紀錄時，預設**全選所有已支援分類的遊戲**（bg／
retro／tw／toys 共約 61 款）：

```ts
function _allowedGamesOf(userId: string): Set<string> {
  let set = _allowedGamesByUser.get(userId)
  if (!set) {
    set = new Set(
      _fullCatalog()
        .filter((g) => SUPPORTED_CATEGORIES.has(g.category))
        .map((g) => _compositeKey(g.category, g.key))
    )
    ...
```

`autoCreateMember()`（server 啟動時建立 20 個 NPC 的那個函式）建立會員後
完全沒有初始化 `allowedGames` 或各分類權重，所以每個 NPC 都落到這個「全選」
預設值，且權重也都共用同一組全域 `_schedule` 預設值——20 個 NPC 行為完全
一致，等於每款遊戲都有全部 20 個 NPC 在玩。

後台「資料統計／會員」頁（`members.get.ts`）統計的是「每款遊戲當月不重複
玩家數」，在這個 demo 環境裡 NPC 是這個統計的主要（甚至唯一）資料來源，
因此每款遊戲的人數自然被拉到幾乎一樣，不像真實玩家會有偏好（有人只玩
台彩、有人只愛柑仔店小遊戲），數字看起來很不自然。

專案裡其實已經有完整的「個別 NPC 自訂」基礎設施（`NpcMemberSetting` 的
`bgWeight`／`retroWeight`／`twWeight`／`toysWeight`、`allowedGames`、
遊戲勾選範本 `NpcGamePreset`），只是從來沒有在「自動新增」這個時間點套用
過，都要管理員事後手動一個一個改。

## 目標

- 自動新增 NPC 時，自動隨機分派一個「玩家原型」，差異化：
  - 偏好哪些遊戲分類（透過各分類權重）
  - 該分類實際勾選幾成的遊戲（不是全選，也不是固定清單，同原型的不同
    NPC 彼此勾選的具體遊戲也要有差異）
- 不新增任何新的對外 API 或 UI 欄位——沿用既有的 `allowedGames`／
  `bgWeight` 等欄位，管理員原本在「NPC 管理」面板看到、能手動調整的東西
  完全不變，只是「自動新增」這個起始值不再是單調的全選

## 範圍

- 包含：
  - `server/services/admin/modules/npcAutoPlay.ts`（新增玩家原型資料與
    隨機分派邏輯，`autoCreateMember()` 建立會員後呼叫）
- 不包含：
  - 不改既有的 `setMemberGameAllowed`／`setMemberGamesBulk`／
    `saveGamePreset`／`applyGamePreset`／`setMemberSetting` 等管理員手動
    調整用的 API，行為完全不變
  - 不改「資料統計／會員」頁本身的統計邏輯（`members.get.ts`）——問題出在
    上游資料（NPC 行為太單調），不是統計方式算錯
  - 不回溯處理目前已經存在、曾經被勾選過全部遊戲的 NPC（in-memory 儲存，
    重啟後會用新邏輯重新建立全部 20 個 NPC，不需要額外遷移）

## 影響面

- 後端 API/Services：`server/services/admin/modules/npcAutoPlay.ts`
- 前端路由/頁面：無直接修改，但「NPC 管理」面板與「資料統計／會員」頁
  呈現的數字皆受益

## 風險與對策

- 技術風險：
  - 風險：隨機分派的原型/遊戲清單完全不可預期，可能導致某些遊戲完全沒有
    任何 NPC 勾選（該月統計為 0 人），或某個原型剛好抽中特別多 NPC
  - 對策：這其實更貼近真實情況（真實玩家分布本來就不會每款遊戲剛好都有
    人玩），而且管理員隨時可以在「NPC 管理」面板手動調整任一 NPC 的勾選，
    不是不可逆的設定
- UI/UX 風險：
  - 風險：無——沿用既有欄位與 UI，管理員介面完全不用改

## 驗證方式

- 功能驗證：
  - 重啟 Nitro（程式碼變更觸發）後，查 `/api/admin/npc/settings`，確認 20
    個 NPC 的 `allowedGames.length`、`bgWeight`／`retroWeight`／
    `twWeight`／`toysWeight` 不再完全一致
  - Playwright 開 `/admin/npc` 確認面板正常渲染、無 console 錯誤
- 回歸驗證：`npm test`（37 支既有測試腳本）全數通過

## 成功標準

- [x] NPC 自動新增後，各自的 `allowedGames`／分類權重皆有差異，不再全選
      全部 61 款遊戲
- [x] 既有管理員手動調整 API／UI 行為不受影響
- [x] 無新增重大 console / runtime error
- [x] 相關測試驗證完成
