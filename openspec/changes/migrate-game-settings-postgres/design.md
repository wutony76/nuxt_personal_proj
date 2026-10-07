# Design

## 1. Schema

```sql
-- 復古遊戲賠率：override-only，缺列 = 用程式碼預設值（RETRO_GAME_BASE 建構子）
CREATE TABLE retro_game_rates (
  game_key          TEXT PRIMARY KEY,
  coin_rate         NUMERIC NOT NULL,
  coin_cap_per_run  INTEGER NOT NULL,
  coin_daily_cap    INTEGER NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 柑仔店各玩法：override-only，缺列 = multiplier/difficulty 1、enabled true
CREATE TABLE toy_shop_games (
  slug        TEXT PRIMARY KEY,
  multiplier  NUMERIC NOT NULL,
  difficulty  NUMERIC NOT NULL,
  enabled     BOOLEAN NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 柑仔店全站總開關：固定 1 列（id='default'）
CREATE TABLE toy_shop_settings (
  id       TEXT PRIMARY KEY DEFAULT 'default',
  enabled  BOOLEAN NOT NULL
);

-- Pac-Man 迷宮樣板：完整複製（陣列型態，沒有程式碼預設值可回退，需要種子分支）
CREATE TABLE pacman_maze_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  rows        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2. 為什麼不是批次同步

四張表全部是「admin 手動操作才會變更」的低頻資料，寫入失敗不可接受（會悄悄回復成錯誤的狀態、
且使用者操作當下預期立即生效），套用既有 write-through 原則：低頻 + 不可接受遺失 → write-through。

跟 `role_game_perms`/`game_global_disabled` 的差異：那邊是「稀疏表示法」（列存在=關閉），這裡
`retro_game_rates`/`toy_shop_games` 是「稀疏 override」（列存在=覆蓋預設值的三/三個欄位），語意
更接近 `role_defs` 的全列寫入，但沒有 `role_defs` 的「種子」分支（因為記憶體裡的程式碼預設值
本來就已經在 `Storage.init()` 跟模組載入時建立好了，不需要靠 DB 種）。

## 3. 各模組實作方式

### 3a. `retroGameRates.ts`

`setRates()` 改 async：驗證通過後，`isDbEnabled()` 時先 `insert ... on conflict (game_key) do
update`，成功才寫入 `game.coinRate` 等欄位（既有驗證邏輯不動）。

新增 `rehydrateFromDb()`：DB 啟用時讀全表，逐列找到 `Storage.retroGames.instances[row.gameKey]`
存在就覆寫三個欄位；找不到對應 instance（例如舊資料殘留已下架的遊戲 key）就跳過，不噴錯。

### 3b. `toyShop.ts`

`setOdds()`/`setGameEnabled()`/`setEnabled()` 改 async，同樣 upsert-then-apply。

新增 `rehydrateFromDb()`：
- 讀 `toy_shop_games` 全表，逐列覆寫 `_odds[slug]`/`_difficulty[slug]`/`_gameEnabled[slug]`
  （找不到對應 catalog slug 就跳過）
- 讀 `toy_shop_settings` 的 `id='default'` 列，存在就覆寫 `_enabled`

兩邊都是純覆蓋，不做「DB 是空的就寫種子」——跟 `role_game_perms.rehydrateFromDb()` 同理：模組
載入時已經用 `TOY_CATALOG` 把三個 Record 填滿預設值，DB 空＝目前預設行為，不需要額外種子迴圈。

### 3c. `mazeTemplates.ts`

`add()`/`remove()` 改 async，write-through。

新增 `rehydrateOrSeed()`（沿用 `roleDefs.ts` 的模式，因為陣列型態 + 有「全新環境」情境需要種子）：
- DB 是空的（全新環境）：把目前 `Storage.retroGames.pacmanMazeTemplates`（模組載入時的
  `DEFAULT_MAZE_TEMPLATES`，目前只有 `classic-01`）寫入 DB
- DB 已有資料：清空並用 DB 內容整個覆蓋 `Storage.retroGames.pacmanMazeTemplates`

`rows: string[]` 存成 `jsonb`（陣列，21 個字串），不用 `text[]`——跟既有 `retro_game_history.meta`
用 jsonb 存複合結構的慣例一致，也省掉 Drizzle `text[]` 跟 jsonb 互相轉換的細節。

## 4. 開機回填順序

四個 `rehydrateFromDb()`/`rehydrateOrSeed()` 呼叫都放在 `hfyyManage.ts` 的 `setStartData()`，
`roleDefs.rehydrateOrSeed()`/`roleGamePerms.rehydrateFromDb()` 之後、members 回填之前都可以
（彼此沒有外鍵或資料依賴關係，四張新表互相獨立、也不依賴 members/role_defs）。整段沿用既有
try/catch 區塊，DB 連不上時退回「只用程式碼/模組預設值」繼續開機，不卡住遊戲 tick 迴圈。

## 5. API 路由層調整

6 個既有路由（`rates.put.ts`/`toy-shop/settings.patch.ts`/`toy-shop/odds/[slug].put.ts`/
`toy-shop/games/[slug].patch.ts`/`maze-templates.post.ts`/`maze-templates/[id].delete.ts`）
的 handler 本來就是 `async defineEventHandler`（除了 `maze-templates/[id].delete.ts` 現在是
同步的，需要改成 async），改成對應 service 方法前面補 `await`，回傳值結構不變，前端無感知。
