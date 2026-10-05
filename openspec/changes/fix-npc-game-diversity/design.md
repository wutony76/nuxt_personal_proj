# Design

## 原型資料結構

```ts
type NpcArchetype = {
  name: string
  weight: number // 抽中機率（相對權重，_pickArchetype() 會用總和正規化）
  categoryWeights: Pick<NpcMemberSetting, 'bgWeight' | 'retroWeight' | 'twWeight' | 'toysWeight'>
  gameSharePct: Record<NpcGameCategory, [min: number, max: number]> // 該分類勾選遊戲數佔該分類總數的隨機百分比區間
}
```

五種原型（`NPC_ARCHETYPES`）：BG 彩迷、復古遊戲宅、台彩鐵粉、柑仔店熟客、
雜食玩家。前四種各自偏重一個分類（該分類權重 80，其餘分類 5~20 之間的
低權重，`gameSharePct` 偏重分類給 30~80% 的較高區間，其餘分類給 0~30%
的低區間，允許抽到 0）；雜食玩家四個分類權重較平均（30~50），但
`gameSharePct` 每個分類也只給 20~60%，**不是全選**——呼應使用者的訴求：
即使是「什麼都碰一點」的玩家，也不該真的什麼都玩。

`weight` 的相對比例（20/20/15/15/30）讓「雜食玩家」略為常見、四個專精型
原型平均分布，貼近真實玩家族群「大部分人雜食、少數人有強烈偏好」的直覺
分布，但不是嚴格的統計模型，純粹是可調的經驗值。

## 隨機分派流程（`_assignArchetype(userId)`）

1. `_pickArchetype()`：依 `weight` 做加權隨機抽一個原型
2. 對四個分類（`SUPPORTED_CATEGORIES`）各自：
   a. 取該分類的完整遊戲清單（`_fullCatalog()` 篩選）
   b. 在原型的 `gameSharePct[category]` 區間內隨機擲一個百分比
   c. 用 Fisher-Yates 洗牌（`_shuffled()`）打亂該分類遊戲清單，取前
      `count` 個——不是固定抽「前 N 個」，確保同原型的不同 NPC 具體勾選
      的遊戲也會不同，不會出現「兩個 NPC 原型一樣、遊戲清單卻一模一樣」
      這種看起來像複製貼上的巧合
3. 把組出來的 `allowedGames` 直接寫入 `_allowedGamesByUser`（取代原本
   `_allowedGamesOf()` 的「第一次存取時全選」預設邏輯——這裡是**主動寫入**，
   之後 `_allowedGamesOf()` 讀到的就是已經寫好的這份，不會再觸發全選分支）
4. 把原型的 `categoryWeights` 直接寫入 `_memberSettings`（透過
   `_memberSettingOf(userId)` 先取一份當前預設值當 base，再用
   `categoryWeights` 覆寫四個權重欄位，整份存回 `_memberSettings`）——
   必須整份存回去，不能只存權重，否則 `_memberSettingOf()` 之後讀到
   「存過設定」會直接回傳存的那份，其餘欄位（`dailyMaxSpend` 等）會變成
   `undefined`

## 為什麼不用既有的 `NpcGamePreset`（遊戲勾選範本）系統

`NpcGamePreset` 是管理員手動在面板上「把目前某個 NPC 的勾選存成命名範本、
之後套用到其他 NPC」的機制，存的是一份**固定**的遊戲清單。這裡要的是
「每次自動新增都重新隨機」，不是套用固定清單，兩者語意不同，直接寫
`_allowedGamesByUser`／`_memberSettings` 比硬套用一個事先存好的範本更
直接、也不會污染管理員自己存的範本清單。

## 為什麼在 `autoCreateMember()` 呼叫，而不是在 `hfyyManage.ts` 的 seed
   迴圈裡

`autoCreateMember()` 同時也是管理員在「NPC 管理」面板按「自動新增」按鈕
時呼叫的同一個函式（見 `app/services/api.ts` 的
`/api/admin/npc/members/auto-create`）。把隨機分派邏輯放在這裡，不管是
server 啟動時建立的 20 個 NPC，還是管理員之後手動點「自動新增」加的新
NPC，都會套用同一套差異化邏輯，不需要重複程式碼，也不會有「只有啟動時
建立的 NPC 才有差異化，手動新增的卻又是全選」這種不一致。
