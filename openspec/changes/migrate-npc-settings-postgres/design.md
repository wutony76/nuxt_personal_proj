# Design

## 1. Schema

```sql
-- 全域設定：總開關 + 排程參數 9 個數值 + 單字庫，固定 1 列（id='default'）
CREATE TABLE npc_settings (
  id                    TEXT PRIMARY KEY DEFAULT 'default',
  enabled               BOOLEAN NOT NULL,
  tick_interval_sec     INTEGER NOT NULL,
  retro_score_min_pct   NUMERIC NOT NULL,
  retro_score_max_pct   NUMERIC NOT NULL,
  bg_weight             NUMERIC NOT NULL,
  retro_weight          NUMERIC NOT NULL,
  tw_weight             NUMERIC NOT NULL,
  toys_weight           NUMERIC NOT NULL,
  bg_bet_amount_min     NUMERIC NOT NULL,
  bg_bet_amount_max     NUMERIC NOT NULL,
  name_words            JSONB NOT NULL
);

-- 遊戲勾選範本
CREATE TABLE npc_game_presets (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  allowed_games JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL
);

-- 每個 NPC 的個別設定，全列寫入（不是 override-only：NPC 一建立就會有 _assignArchetype() 寫入，
-- 密集而非稀疏，見 design.md 第 2 節）
CREATE TABLE npc_member_settings (
  user_id                   TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  daily_max_spend           NUMERIC NOT NULL,
  top_up_amount             NUMERIC NOT NULL,
  retro_score_min_pct       NUMERIC NOT NULL,
  retro_score_max_pct       NUMERIC NOT NULL,
  bg_weight                 NUMERIC NOT NULL,
  retro_weight              NUMERIC NOT NULL,
  tw_weight                 NUMERIC NOT NULL,
  toys_weight               NUMERIC NOT NULL,
  bg_bet_amount_min         NUMERIC NOT NULL,
  bg_bet_amount_max         NUMERIC NOT NULL,
  active_time_slots         JSONB NOT NULL,
  action_interval_sec       INTEGER NOT NULL,
  action_jitter_chance_pct  NUMERIC NOT NULL,
  action_jitter_max_sec     NUMERIC NOT NULL,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 每個 NPC 勾選的遊戲，稀疏表示法：一列存在＝允許（跟 role_game_perms「列存在＝關閉」相反語意，
-- 見 design.md 第 2 節）
CREATE TABLE npc_member_games (
  user_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category  TEXT NOT NULL,
  key       TEXT NOT NULL,
  PRIMARY KEY (user_id, category, key)
);

-- NPC 每日已花費，PK 只用 user_id（不是 (user_id, date_key)）：跟記憶體的
-- Map<userId, {dateKey, amount}> 語意一致——每人只有「當前這一天」一筆計數器，跨日直接覆蓋，
-- 不是像 retro_daily_grants 那樣保留逐日歷史
CREATE TABLE npc_daily_spent (
  user_id     TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  date_key    TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`user_id` 一律用 `ON DELETE CASCADE`：這些都是 NPC 的附屬設定，NPC 會員被刪除（若未來補上刪除
會員功能）時應該一併清除，跟 `role_game_perms.role_id` 的理由一致。

## 2. 為什麼 `npc_member_settings` 是全列寫入、不是 override-only

跟 `retro_game_rates`/`toy_shop_games` 不同：那兩個是「程式碼已經有合理預設值，DB 只存例外」。
NPC 的設定沒有這種「程式碼預設」——`_memberSettingOf()` 的 fallback（套用全域 `_schedule`）
本身就是 bug 的來源（见 proposal.md）。`_assignArchetype()` 在 NPC 建立當下就會立刻呼叫
`_memberSettings.set()` 寫入一筆完整設定，所以實務上這張表會是「密集」而非「稀疏」——每個 NPC
建立後都有對應列，不依賴 DB 空值回退程式碼預設。

## 3. 各方法異動

### 3a. 全域設定（`setEnabled`/`updateSchedule`/`setNameWords`）

三個方法改 async write-through，upsert 進 `npc_settings` 的 `id='default'` 列（各自只更新
自己負責的欄位）。

### 3b. `_assignArchetype()`（NPC 建立時呼叫）

改 async：算出 `allowed`/`archetype.categoryWeights` 後，write-through 寫入
`npc_member_settings`（完整 upsert）與 `npc_member_games`（先刪除該 user 的舊列、再整批
insert，因為是整份覆蓋不是增量調整）。`autoCreateMember()` 呼叫處補 `await`。

### 3c. `setMemberGameAllowed`/`setMemberGamesBulk`/`applyGamePreset`

改 async write-through：
- `setMemberGameAllowed`：`allowed=true` 時 insert 一列（`onConflictDoNothing`），`false` 時
  delete 該列（跟 `roleGamePermsService.toggle()` 同構，只是語意相反）
- `setMemberGamesBulk`：批次 insert/delete 該分類下所有 key
- `applyGamePreset`：先刪除該 user 的全部列，再整批 insert 範本內容（整份覆蓋）

### 3d. `saveGamePreset`/`deleteGamePreset`

改 async write-through，`npc_game_presets` 的 insert/delete。

**`_gamePresetSeq` 的 id 衝突修正**：原本 `preset-${++_gamePresetSeq}` 只在記憶體遞增，重啟後
`_gamePresetSeq` 歸零，新範本的 id 會跟 DB 裡已存在的舊範本撞名。`rehydrateFromDb()` 回填時，
從 DB 現有 id 解析出最大的數字後綴，把 `_gamePresetSeq` 設回該值，之後再遞增就不會撞號。

### 3e. `setMemberSetting()`

改 async write-through，`npc_member_settings` 整列 upsert。

### 3f. `_addSpent()`（高頻，tick 路徑呼叫）

改 async write-through，upsert `npc_daily_spent`（`date_key`/`amount` 跟記憶體同步覆蓋）。
呼叫端分兩種：
- `_playRandomBg`/`_playRandomTw`/`_playRandomToys`（`tick()` 的同步路徑呼叫）：`void
  _addSpent(...).catch(...)` fire-and-forget，比照 `_playRandomRetro()` 對
  `game.actions.record()` 已有的既有模式，不讓 tick() 整條鏈被迫改 async
- `testPlayAll()`（本來就是 async 函式）：直接 `await`

### 3g. 開機回填：`rehydrateOrSeed()`

放在 `hfyyManage.ts` 的 `access.rehydrateFromDb()`/會員種子分支**之後**（`npc_member_settings`/
`npc_member_games`/`npc_daily_spent` 都有 FK 指向 `members.id`，邏輯上必須等會員資料確定後再處理，
雖然這裡只是 SELECT 不是寫入，但跟既有「members 先、附屬設定後」的順序保持一致，閱讀起來更合理）：

```ts
rehydrateOrSeed: async (): Promise<void> => {
  if (!isDbEnabled()) return
  const db = getDb()

  // 1. 全域設定：空則種子（_enabled 的種子值固定 true，對應 hfyyManage.ts 原本無條件
  //    setEnabled(true) 的效果），有則回填
  const settingsRow = await db.select().from(npcSettingsTable)
    .where(eq(npcSettingsTable.id, 'default')).then((rows) => rows[0])
  if (!settingsRow) {
    await db.insert(npcSettingsTable).values({ id: 'default', enabled: true, ..._toDbSchedule(_schedule), nameWords: _nameWords })
    _enabled = true
  } else {
    _enabled = settingsRow.enabled
    _schedule = _fromDbSchedule(settingsRow)
    _nameWords = settingsRow.nameWords as string[]
  }

  // 2. 遊戲勾選範本：整批回填，並修正 _gamePresetSeq 避免 id 衝突
  const presetRows = await db.select().from(npcGamePresetsTable)
  _gamePresets.clear()
  let maxSeq = 0
  for (const row of presetRows) {
    _gamePresets.set(row.id, { id: row.id, name: row.name, allowedGames: row.allowedGames as string[], createdAt: row.createdAt.getTime() })
    const m = /^preset-(\d+)$/.exec(row.id)
    if (m) maxSeq = Math.max(maxSeq, Number(m[1]))
  }
  _gamePresetSeq = maxSeq

  // 3. 每個 NPC 的個別設定 + 勾選遊戲
  const [memberSettingRows, memberGameRows] = await Promise.all([
    db.select().from(npcMemberSettingsTable),
    db.select().from(npcMemberGamesTable)
  ])
  _memberSettings.clear()
  for (const row of memberSettingRows) _memberSettings.set(row.userId, _fromDbMemberSetting(row))
  _allowedGamesByUser.clear()
  for (const row of memberGameRows) {
    if (!_allowedGamesByUser.has(row.userId)) _allowedGamesByUser.set(row.userId, new Set())
    _allowedGamesByUser.get(row.userId)!.add(_compositeKey(row.category, row.key))
  }

  // 4. 今日已花費：只回填 date_key 等於今天的列（比照 retro_daily_grants 的
  //    rehydrateTodayDailyGrantsFromDb()，跨日的舊資料視為「今天還沒花」）
  const today = _dateKey()
  const spentRows = await db.select().from(npcDailySpentTable)
  _dailySpent.clear()
  for (const row of spentRows) {
    if (row.dateKey !== today) continue
    _dailySpent.set(row.userId, { dateKey: row.dateKey, amount: Number(row.amount) })
  }
}
```

這份資料**沒有「全新環境種子遊戲清單/個別設定」的分支**：第 2/3/4 點都是「DB 有什麼就回填什麼，
沒有就維持空（`_allowedGamesOf()`/`_memberSettingOf()` 原本的 fallback 邏輯本來就會接手）」。
真正的「新 NPC 預設值」是 `autoCreateMember()` → `_assignArchetype()` 流程自己產生、自己
write-through，不需要 `rehydrateOrSeed()` 額外處理種子。

## 4. `hfyyManage.ts` 呼叫端調整

```ts
// 既有分支（access.rehydrateFromDb() / 會員種子迴圈）跑完之後：
await this.npcAutoPlay.rehydrateOrSeed()
```

放進既有 try/catch 區塊。結尾原本的無條件 `this.npcAutoPlay.setEnabled(true)` 改成：

```ts
// DB 未啟用時維持原本「NPC 自動遊玩預設開啟」行為；DB 啟用時尊重 rehydrateOrSeed() 回填的
// _enabled 值（新環境一樣會是 true，但既有環境若管理員手動關閉過，重啟後必須維持關閉）
if (!isDbEnabled()) {
  this.npcAutoPlay.setEnabled(true)
}
```

## 5. API 路由層調整

9 個路由補 `await`：`settings.patch.ts`（`setEnabled`/`updateSchedule`）、
`name-words.patch.ts`、`game-presets.post.ts`、`game-presets/[id].delete.ts`、
`members/[userId]/settings.patch.ts`、`members/[userId]/games/[category]/[key].put.ts`、
`members/[userId]/games/apply-preset.put.ts`、`members/[userId]/games/bulk.put.ts`
（`auto-create.post.ts` 已經是 `await`，不用改)。
