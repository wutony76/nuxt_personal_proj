import { MEMORY } from '../services/base'

export default defineEventHandler(() => {
  return {
    serverTime: MEMORY.now.getTime()
  }
})
