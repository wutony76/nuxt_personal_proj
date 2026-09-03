
import { Storage } from '../services/storage'
import BaseClass from '../services/base'

export default defineNitroPlugin((_nitroApp) => {
  console.log('')
  console.log('')
  console.log('')
  console.log('')
  console.log('***NEW---------SERV.INIT')
  Storage.init()
  new BaseClass().runCircle(() => {
    // console.log('BaseClass.runCircle.Task')
    // console.log(Storage.games)

    // --- 遊戲排程
    Object.values(Storage.games).forEach((game) => {
      if (game && typeof (game as { circle?: () => void }).circle === 'function') {
        ; (game as { circle: () => void }).circle()
      }
    })

    // --- ADMIN 後台排程
    Storage.manager.admin.circle()


  })
  console.log('SERV.RUN')
})