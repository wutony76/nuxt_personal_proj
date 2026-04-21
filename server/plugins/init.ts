
import { Storage } from '../services/storage'
import BaseClass from '../services/base'

export default defineNitroPlugin((nitroApp) => {
  Storage.init()
  new BaseClass().runCircle(() => {
    console.log('BaseClass.runCircle.Task')
    console.log(Storage.games)
    Object.values(Storage.games).forEach((game) => {
      if (game && typeof (game as { circle?: () => void }).circle === 'function') {
        ;(game as { circle: () => void }).circle()
      }
    })
  })

  console.log('SERV.RUN')
})