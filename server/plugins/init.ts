
import { Storage } from '../services/storage'
import BaseClass from '../services/base'
import { socketHub } from '../services/social/socketHub'
import { chatScheduleService } from '../services/social/chatSchedule'

export default defineNitroPlugin((_nitroApp) => {
  console.log('')
  console.log('')
  console.log('')
  console.log('')
  console.log('***NEW---------SERV.INIT')
  Storage.init()
  socketHub.init()
  new BaseClass().runCircle(() => {
    // console.log('BaseClass.runCircle.Task')
    // console.log(Storage.games)
    Object.values(Storage.games).forEach((game) => {
      if (game && typeof (game as { circle?: () => void }).circle === 'function') {
        ; (game as { circle: () => void }).circle()
      }
    })
    chatScheduleService.tick()
  })
  console.log('SERV.RUN')
})