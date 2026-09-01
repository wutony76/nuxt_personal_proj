/**
 * 管理員白名單：目前只分「是不是 admin」，沒有角色分級。
 * 比照 coin 兌換三常數的既有慣例，先用程式碼常數頂著；新增/移除管理員需改這裡＋重新部署，
 * 後台不提供異動介面（避免「要先是 admin 才能管理誰是 admin」的雞生蛋問題）。
 * 見 openspec/changes/add-admin-backend/design.md Decision 1。
 */
export const ADMIN_USER_IDS: string[] = ['U0xA000001', 'U0xA666666']
