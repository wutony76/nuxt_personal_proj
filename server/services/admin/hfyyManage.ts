import { socketHub } from 'serv/services/social/socketHub'
import { chatScheduleService } from 'serv/services/social/chatSchedule'
import { loginHistoryService } from 'serv/services/loginHistory'
import { adminAccessService } from './modules/adminAccess'
import { memberBalanceHistoryService } from './modules/memberBalanceHistory'

/**
 * 後台會員／權限／聊天室管理入口：不分遊戲類別的後台功能掛在這裡。
 * 遊戲類別（經典遊戲／遊戲試算／BG彩票／台彩）各自的 hfyy*.ts facade
 * 改掛在 Storage.manager 底下，跟這裡是平行關係，不透過 HFYYManage 組裝
 * （見 storage.ts 的 static manager）。
 * init()／circle() 是另一種職責：Nitro plugin 生命週期掛勾（見 server/plugins/init.ts），
 * 跟上面這些請求層的 CRUD service 無關，兩者共存於同一個 class 只是因為都歸「後台」管。
 */
export default class HFYYManage {
  readonly access = adminAccessService
  readonly balanceHistory = memberBalanceHistoryService
  readonly loginHistory = loginHistoryService
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