import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 快3：共用彩池狀態（官方盤吃池分頁分層吃這個池，K3-CD 與 K3-OF 共用同一份）
 *
 * ⚠️ 與 jackpot.get.ts 是兩個完全獨立的池——這支是官方盤分層派彩用的共用彩池，
 *    jackpot.get.ts 是爆池（兩個盤口共吃、開出爆池條件才發放），兩者互不影響。
 * ⚠️ 這份資料原本只內嵌在 /k3-of/current 的 `pool` 欄位裡，這裡另開一支給不需要
 *    整包當期資訊、只要彩池總額的呼叫端用（例如大廳的彩池跑馬燈）。
 */
type K3OfService = {
  get: {
    poolState?: () => Record<string, unknown>
  }
}

const EMPTY = {
  issue: '',
  base: 0,
  carry: 0,
  issuePool: 0,
  distributable: 0
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY['K3-OF'].key] as K3OfService | undefined
  return game?.get?.poolState?.() ?? EMPTY
})
