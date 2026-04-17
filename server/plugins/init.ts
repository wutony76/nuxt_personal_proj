
import { Storage } from '../services/storage'

export default defineNitroPlugin((nitroApp) => {
  Storage.init()
  console.log('SERV.RUN')
})