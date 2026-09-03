import { socketHub } from 'serv/services/social/socketHub'
import { chatScheduleService } from 'serv/services/social/chatSchedule'
import { mazeTemplates, validateMazeRows } from 'serv/services/game/retro/mazeTemplates'
import { loginHistoryService } from 'serv/services/loginHistory'
import { adminAccessService } from './adminAccess'
import { memberBalanceHistoryService } from './memberBalanceHistory'
import { adminPoolAuditService } from './poolAudit'
import { adminGameHistoryService } from './gameHistory'
import { adminRetroGameRatesService } from './retroGameRates'

/**
 * 後台唯一入口：所有 server/api/admin/* 路由一律透過 Storage.manager.admin 呼叫，
 * 不再各自 import 散落各處的 service 檔案。實作仍分散在各自的 service 檔（不搬邏輯進來，
 * 只在這裡組裝成具名屬性），避免變成什麼都做的 god class。
 * init()／circle() 是另一種職責：Nitro plugin 生命週期掛勾（見 server/plugins/init.ts），
 * 跟底下這些請求層的 CRUD service 無關，兩者共存於同一個 class 只是因為都歸「後台」管。
 */
export default class HFYYManage {
  readonly access = adminAccessService
  readonly balanceHistory = memberBalanceHistoryService
  readonly loginHistory = loginHistoryService
  readonly poolAudit = adminPoolAuditService
  readonly gameHistory = adminGameHistoryService
  readonly retroGameRates = adminRetroGameRatesService
  readonly mazeTemplates = mazeTemplates
  readonly validateMazeRows = validateMazeRows
  readonly chatSchedule = chatScheduleService

  constructor() {
    // 改由 Storage.init() 明確呼叫 init()，建構子不自己呼叫，避免重複執行
  }

  init() {
    console.log('----- HFYY.Manager.init -----')
    socketHub.init()
  }

  circle() {
    this.chatSchedule.tick()
  }
}