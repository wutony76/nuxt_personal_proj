import { pgTable, text, boolean, integer, numeric, timestamp, jsonb, index, primaryKey } from 'drizzle-orm/pg-core'

/**
 * 對應 server/services/admin/modules/roleDefs.ts 的 RoleDef（見
 * openspec/changes/migrate-members-roledefs-postgres/design.md 第 3 節）。
 */
export const roleDefs = pgTable('role_defs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  builtin: boolean('builtin').notNull().default(false),
  testMode: boolean('test_mode').notNull().default(false),
  npcMode: boolean('npc_mode').notNull().default(false),
  demoMode: boolean('demo_mode').notNull().default(false),
  dailyCoinRewardEnabled: boolean('daily_coin_reward_enabled').notNull().default(false),
  dailyCoinRewardAmount: integer('daily_coin_reward_amount').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

/**
 * 對應 Storage.account（members 本體）+ adminAccess.ts 的 adminIds/memberRoleId。
 * role_id 與 is_admin 刻意正交，見 design.md 第 3 節說明。
 */
export const members = pgTable('members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  roleId: text('role_id').notNull().default('user').references(() => roleDefs.id, { onDelete: 'set default' }),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

/**
 * 23 款彩票玩法（15 BG + 8 TW）統一成一張表，取代各自獨立的 `OrdersClass` 記憶體結構，
 * 見 openspec/changes/migrate-game-history-postgres/design.md 第 5 節。走批次同步（非
 * write-through），只歸檔已結算期別，見 `server/services/game/lottery/ordersSyncSource.ts`。
 */
export const gameOrders = pgTable('game_orders', {
  orderId: text('order_id').primaryKey(),
  gameKey: text('game_key').notNull(),
  issue: text('issue').notNull(),
  userId: text('user_id').notNull(),
  tabId: text('tab_id'),
  /** 玩法 key（tema/zhengma/ball…），design.md 原始 schema 沒列，Implementation 階段發現
   *  bg-summary.get.ts 的玩法排行需要這個欄位才補上（比照 tab_id 獨立成欄，不塞進 bet_code JSONB）。 */
  playKey: text('play_key'),
  coin: numeric('coin').notNull(),
  betCode: jsonb('bet_code').notNull(),
  odds: numeric('odds'),
  tiers: jsonb('tiers'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index('idx_game_orders_game_issue').on(table.gameKey, table.issue),
  index('idx_game_orders_user_month').on(table.userId, table.createdAt)
])

/** 30 款復古遊戲共用一張表，全量快照同步（不裁剪，見 design.md 第 7 節）。 */
export const retroGameHistory = pgTable('retro_game_history', {
  id: text('id').primaryKey(),
  gameKey: text('game_key').notNull(),
  userId: text('user_id').notNull(),
  score: integer('score').notNull(),
  level: integer('level'),
  meta: jsonb('meta'),
  playedAt: timestamp('played_at', { withTimezone: true }).notNull()
}, (table) => [
  index('idx_retro_history_user_month').on(table.userId, table.playedAt)
])

/** 彩池重骰事件，全站共用，全量快照同步（記憶體有 2000→1800 上限，DB 保留完整歷史）。 */
export const poolAuditReseed = pgTable('pool_audit_reseed', {
  id: text('id').primaryKey(),
  lotteryKey: text('lottery_key').notNull(),
  issue: text('issue').notNull(),
  before: numeric('before').notNull(),
  after: numeric('after').notNull(),
  happenedAt: timestamp('happened_at', { withTimezone: true }).notNull()
})

/** 保底超付事件，同上。 */
export const poolAuditOverpay = pgTable('pool_audit_overpay', {
  id: text('id').primaryKey(),
  lotteryKey: text('lottery_key').notNull(),
  issue: text('issue').notNull(),
  overpay: numeric('overpay').notNull(),
  happenedAt: timestamp('happened_at', { withTimezone: true }).notNull()
})

/**
 * 復古遊戲每日 coin 核發計數器，write-through（非批次同步），修正重啟導致當日配額歸零的
 * 既有缺口，見 design.md 第 4 節決策記錄。
 */
export const retroDailyGrants = pgTable('retro_daily_grants', {
  userId: text('user_id').notNull(),
  gameKey: text('game_key').notNull(),
  dateKey: text('date_key').notNull(),
  amount: integer('amount').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  primaryKey({ columns: [table.userId, table.gameKey, table.dateKey] })
])

/**
 * 角色遊戲權限開關，見 openspec/changes/migrate-role-game-perms-postgres/design.md。
 * 稀疏表示法：一列存在 = 該角色該項目被關閉（跟現有記憶體 disabledByRole 語意一致）。
 * role_id 用 ON DELETE CASCADE（不是 members 用的 SET DEFAULT）：這是角色的附屬設定，
 * 角色沒了，設定也該一起消失。
 */
export const roleGamePerms = pgTable('role_game_perms', {
  roleId: text('role_id').notNull().references(() => roleDefs.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  key: text('key').notNull()
}, (table) => [
  primaryKey({ columns: [table.roleId, table.category, table.key] })
])

/** 遊戲/盤口的全站總閘開關，同上稀疏表示法：一列存在 = 全站關閉。 */
export const gameGlobalDisabled = pgTable('game_global_disabled', {
  category: text('category').notNull(),
  key: text('key').notNull()
}, (table) => [
  primaryKey({ columns: [table.category, table.key] })
])

/**
 * 登入稽核紀錄，見 openspec/changes/migrate-login-history-postgres/design.md。
 * 全量快照同步（不裁剪，記憶體本身已有每人 100 筆上限），扁平化 user_id 取代現有
 * Map<userId, entries[]> 分桶。
 */
export const loginHistory = pgTable('login_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  ip: text('ip').notNull(),
  userAgent: text('user_agent').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
}, (table) => [
  index('idx_login_history_user').on(table.userId, table.createdAt)
])

/**
 * 復古遊戲 coin 兌換三常數，見 openspec/changes/migrate-game-settings-postgres/design.md 第 1 節。
 * override-only：缺列＝用 RETRO_GAME_BASE 建構子的程式碼預設值，不是「種子」表。
 */
export const retroGameRates = pgTable('retro_game_rates', {
  gameKey: text('game_key').primaryKey(),
  coinRate: numeric('coin_rate').notNull(),
  coinCapPerRun: integer('coin_cap_per_run').notNull(),
  coinDailyCap: integer('coin_daily_cap').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

/** 柑仔店各玩法賠率/難度/上下架，override-only（缺列＝multiplier/difficulty 1、enabled true）。 */
export const toyShopGames = pgTable('toy_shop_games', {
  slug: text('slug').primaryKey(),
  multiplier: numeric('multiplier').notNull(),
  difficulty: numeric('difficulty').notNull(),
  enabled: boolean('enabled').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

/** 柑仔店全站總開關，固定 1 列（id='default'）。 */
export const toyShopSettings = pgTable('toy_shop_settings', {
  id: text('id').primaryKey().default('default'),
  enabled: boolean('enabled').notNull()
})

/**
 * Pac-Man 固定樣板迷宮，完整複製（不是 override-only：陣列型態沒有程式碼預設值可回退，
 * 見 design.md 第 3c 節，需要「空則種子」分支）。
 */
export const pacmanMazeTemplates = pgTable('pacman_maze_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  rows: jsonb('rows').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

/**
 * 聊天室廣播排程設定欄位，見 openspec/changes/migrate-chat-schedule-postgres/design.md。
 * 只存設定欄位，運行游標（lastFiredKey/lastFiredAt）刻意不持久化（見 design.md 第 5 節）。
 */
export const chatSchedules = pgTable('chat_schedules', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  hour: integer('hour').notNull(),
  minute: integer('minute').notNull(),
  repeat: text('repeat').notNull(),
  intervalSeconds: integer('interval_seconds'),
  enabled: boolean('enabled').notNull(),
  createdBy: text('created_by').notNull(),
  createdByName: text('created_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
})

/**
 * NPC 全域設定，固定 1 列（id='default'），見
 * openspec/changes/migrate-npc-settings-postgres/design.md 第 1 節。
 */
export const npcSettings = pgTable('npc_settings', {
  id: text('id').primaryKey().default('default'),
  enabled: boolean('enabled').notNull(),
  tickIntervalSec: integer('tick_interval_sec').notNull(),
  retroScoreMinPct: numeric('retro_score_min_pct').notNull(),
  retroScoreMaxPct: numeric('retro_score_max_pct').notNull(),
  bgWeight: numeric('bg_weight').notNull(),
  retroWeight: numeric('retro_weight').notNull(),
  twWeight: numeric('tw_weight').notNull(),
  toysWeight: numeric('toys_weight').notNull(),
  bgBetAmountMin: numeric('bg_bet_amount_min').notNull(),
  bgBetAmountMax: numeric('bg_bet_amount_max').notNull(),
  nameWords: jsonb('name_words').notNull()
})

/** NPC 遊戲勾選範本。 */
export const npcGamePresets = pgTable('npc_game_presets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  allowedGames: jsonb('allowed_games').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
})

/**
 * 每個 NPC 的個別設定，全列寫入（不是 override-only，見 design.md 第 2 節：
 * `_assignArchetype()` 在 NPC 建立當下就會寫入完整一列，這張表實務上是密集的）。
 */
export const npcMemberSettings = pgTable('npc_member_settings', {
  userId: text('user_id').primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  dailyMaxSpend: numeric('daily_max_spend').notNull(),
  topUpAmount: numeric('top_up_amount').notNull(),
  retroScoreMinPct: numeric('retro_score_min_pct').notNull(),
  retroScoreMaxPct: numeric('retro_score_max_pct').notNull(),
  bgWeight: numeric('bg_weight').notNull(),
  retroWeight: numeric('retro_weight').notNull(),
  twWeight: numeric('tw_weight').notNull(),
  toysWeight: numeric('toys_weight').notNull(),
  bgBetAmountMin: numeric('bg_bet_amount_min').notNull(),
  bgBetAmountMax: numeric('bg_bet_amount_max').notNull(),
  activeTimeSlots: jsonb('active_time_slots').notNull(),
  actionIntervalSec: integer('action_interval_sec').notNull(),
  actionJitterChancePct: numeric('action_jitter_chance_pct').notNull(),
  actionJitterMaxSec: numeric('action_jitter_max_sec').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

/**
 * 每個 NPC 勾選的遊戲，稀疏表示法：一列存在＝允許（跟 `role_game_perms`「列存在＝關閉」
 * 相反語意，見 design.md 第 1 節）。
 */
export const npcMemberGames = pgTable('npc_member_games', {
  userId: text('user_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  key: text('key').notNull()
}, (table) => [
  primaryKey({ columns: [table.userId, table.category, table.key] })
])

/**
 * NPC 每日已花費，PK 只用 user_id（不是 `(user_id, date_key)`）：跟記憶體的
 * `Map<userId, {dateKey, amount}>` 語意一致，每人只有「當前這一天」一筆計數器，跨日覆蓋，
 * 不像 `retro_daily_grants` 保留逐日歷史，見 design.md 第 1 節。
 */
export const npcDailySpent = pgTable('npc_daily_spent', {
  userId: text('user_id').primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  dateKey: text('date_key').notNull(),
  amount: numeric('amount').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})
