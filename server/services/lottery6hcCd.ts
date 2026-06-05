import { Storage } from './storage'
import { LOTTERY } from '~/config/constants'
import LOTTERY_BASE from './lotteryBase'

type BetOrderRow = {
  issue: string
  user_id: string
  bet_time: number
  coin: number
  order_id: string
  status: 'success'
  bet_code: string[]
  play_key: string
  play_type_name: string
}

type Group = {
  playTypeName?: string
  playKey?: string
  playList?: Array<{ num?: number | string; label?: string | number }>
}

type PlayBetsPayload = {
  amount?: number
  groups?: Group[]
}

type UserStoreLike = {
  userId?: string
  coin?: number
}

export default class LHC_CD extends LOTTERY_BASE {
  declare handle: LOTTERY_BASE['handle'] & {
    buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }) => BetOrderRow[]
  }

  constructor() {
    super(LOTTERY['LHC-CD'].key, LOTTERY['LHC-CD'].id)
    Object.assign(this.handle, {
      openCodePlay: (openCode: string[]) => {
        return openCode
          .map((code) => {
            const num = Number(code)
            if (!Number.isFinite(num)) return null
            return (Storage.get.lotteryPlay(LOTTERY['6HC'].id, num) ?? null) as Record<string, unknown> | null
          })
          .filter((play): play is Record<string, unknown> => Boolean(play))
      },
      buildOrderRows: (input: { issue: string; userId: string; amount: number; groups: Group[] }): BetOrderRow[] => {
        const rows: BetOrderRow[] = []
        input.groups.forEach((group) => {
          const playTypeName = String(group?.playTypeName || '')
          const playKey = String(group?.playKey || '')
          const playList = Array.isArray(group?.playList) ? group.playList : []
          playList.forEach((play) => {
            const orderId = this.handle.createOrderId(input.issue)
            const betCode = LOTTERY_BASE.normalizeBetCode(play)
            if (!betCode) return
            rows.push({
              issue: input.issue,
              user_id: input.userId,
              bet_time: Date.now(),
              coin: input.amount,
              order_id: `${orderId}(1/1)`,
              status: 'success',
              bet_code: [betCode],
              play_key: playKey,
              play_type_name: playTypeName
            })
          })
        })
        if (rows.length > 0) return rows
        const orderId = this.handle.createOrderId(input.issue)
        return [{
          issue: input.issue,
          user_id: input.userId,
          bet_time: Date.now(),
          coin: input.amount,
          order_id: `${orderId}(1/1)`,
          status: 'success',
          bet_code: [],
          play_key: '',
          play_type_name: ''
        }]
      }
    })
    this.init()
  }

  init() {
    this.handle.prdOpenCode()
    Storage.games[this.key] = this
    LOTTERY_BASE.getOrders(this.id, this.key)
  }

  circle() {
    this.handle.refreshCurrent(new Date())
  }

  playBets(payload: PlayBetsPayload, user: UserStoreLike) {
    const amount = Number(payload?.amount ?? 0)
    const userId = String(user?.userId ?? '')
    const beforeCoin = Number(user?.coin ?? 0)
    user.coin = beforeCoin - amount

    const issue = this.recordOpenCode[this.currentIndex]?.issue ?? this._get.latestIssue()
    const groups = Array.isArray(payload?.groups) ? payload.groups : []
    const rows = this.handle.buildOrderRows({ issue, userId, amount, groups })

    const orders = this._get.orders()
    rows.forEach((row) => {
      orders.add.record({
        issue: row.issue,
        userId: row.user_id,
        coin: row.coin,
        orderId: row.order_id,
        betCode: row.bet_code
      })
    })

    return {
      orderId: rows[0]?.order_id ? String(rows[0].order_id).split('(')[0] : '',
      orders: rows
    }
  }
}
