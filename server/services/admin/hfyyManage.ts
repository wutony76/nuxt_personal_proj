import { socketHub } from 'serv/services/social/socketHub'
import { chatScheduleService } from 'serv/services/social/chatSchedule'


export default class HFYYManage {
  constructor() {
    // 改Storage.init() 初始化
    // this.init()
  }

  init() {
    console.log('----- HFYY.Manager.init -----')
    socketHub.init()
  }

  circle() {
    chatScheduleService.tick()
  }
}