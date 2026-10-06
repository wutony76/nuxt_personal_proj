import { pgTable, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

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
