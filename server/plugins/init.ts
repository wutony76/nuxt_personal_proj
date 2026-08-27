
import { Storage } from '../services/storage'
import BaseClass from '../services/base'
import { socketHub } from '../services/social/socketHub'

export default defineNitroPlugin((nitroApp) => {
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
  })
  console.log('SERV.RUN')
})