import { adminPoolAuditService } from './modules/poolAudit'

/**
 * BG 彩票（六合彩／快3／PK10／時時彩／11選5…等信用盤＋官方盤）後台管理入口，
 * 掛在 Storage.manager.lotteryBg（見 storage.ts）。
 * 實作仍在各自的 service 檔，這裡只組裝成具名屬性。
 */
export default class HFYYLotteryBg {
  readonly poolAudit = adminPoolAuditService
}
