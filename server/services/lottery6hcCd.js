import { LOTTERY } from '~/config/constants.js'
import { Storage } from './storage'
import OrdersClass from './orders'

const createIssue = () => {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const seq = String((now.getHours() * 60 + now.getMinutes()) % 300).padStart(3, '0')
  return `${year}${month}${day}${seq}`
}

const normalizeBetCode = (play) => {
  const num = Number(play?.num)
  if (Number.isFinite(num) && num > 0) {
    return String(num).padStart(2, '0')
  }
  return String(play?.label ?? '').trim()
}

export default class LhcCdClass {
  constructor() {
    this.id = LOTTERY['LHC-CD'].id
    this.lotteryKey = LOTTERY['LHC-CD'].key
    this.issueSerialMap = {}
    this.init()
  }

  init() {
    Storage.games[this.lotteryKey] = this
    this._get.orders()
  }

  playBets(payload, user) {
    const amount = Number(payload?.amount ?? 0)
    const issue = createIssue()
    const userId = String(user?.userId ?? '')
    const beforeCoin = Number(user?.coin ?? 0)
    user.coin = beforeCoin - amount

    const groups = Array.isArray(payload?.groups) ? payload.groups : []
    const rows = this._handlers.buildRows({
      issue,
      userId,
      amount,
      groups
    })

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

  _get = {
    orders: () => {
      const map = Storage.lottery.orders
      if (!map[this.lotteryKey]) {
        map[this.lotteryKey] = new OrdersClass({ id: this.id, key: this.lotteryKey })
      }
      return map[this.lotteryKey]
    }
  }

  _handlers = {
    nextOrderSerial: (issue) => {
      const current = Number(this.issueSerialMap[issue] ?? 0) + 1
      this.issueSerialMap[issue] = current
      return String(current).padStart(6, '0')
    },
    buildRows: ({ issue, userId, amount, groups }) => {
      const rows = []
      groups.forEach((group) => {
        const playTypeName = String(group?.playTypeName || '')
        const playKey = String(group?.playKey || '')
        const playList = Array.isArray(group?.playList) ? group.playList : []
        playList.forEach((play) => {
          const serial = this._handlers.nextOrderSerial(issue)
          const orderBaseId = `${this.lotteryKey}${issue}${serial}`
          const betCode = normalizeBetCode(play)
          if (!betCode) {
            return
          }
          rows.push({
            issue,
            user_id: userId,
            bet_time: Date.now(),
            coin: amount,
            order_id: `${orderBaseId}(1/1)`,
            status: 'success',
            bet_code: [betCode],
            play_key: playKey,
            play_type_name: playTypeName
          })
        })
      })
      if (rows.length > 0) {
        return rows
      }
      const serial = this._handlers.nextOrderSerial(issue)
      const orderBaseId = `${this.lotteryKey}${issue}${serial}`
      return [
        {
          issue,
          user_id: userId,
          bet_time: Date.now(),
          coin: amount,
          order_id: `${orderBaseId}(1/1)`,
          status: 'success',
          bet_code: [],
          play_key: '',
          play_type_name: ''
        }
      ]
    }
  }
}

