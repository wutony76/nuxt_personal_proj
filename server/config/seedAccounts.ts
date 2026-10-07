/**
 * 種子管理員帳號的密碼來源。
 *
 * - 開發環境：沒設定環境變數時沿用 `123456`，方便本機登入與 E2E 測試。
 * - production：必須透過環境變數設定，沒設定就直接拋錯、拒絕啟動。這兩個帳號都在管理員白名單
 *   （`server/config/admin.ts`）內，擁有完整寫入權限；公開部署時若沿用公開的預設密碼，
 *   任何人都能登入後台。
 *
 * ⚠️ 接了資料庫（`DATABASE_URL`）時，這裡的值只在「資料庫還沒有任何會員」的第一次啟動時寫入；
 * 之後以資料庫為準，修改環境變數不會改到既有密碼。
 */
const DEV_DEFAULT_PASSWORD = '123456'

export function seedPassword(envName: 'SEED_ADMIN_PASSWORD' | 'SEED_OWNER_PASSWORD'): string {
  const value = process.env[envName]
  if (value) return value
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`production 環境必須設定 ${envName}，不能使用預設密碼（見 docs/deployment/gcp-vm.md）`)
  }
  return DEV_DEFAULT_PASSWORD
}
