import { Storage } from './storage'

type OrderRow = {
  issue: string
  userId: string
  coin: number
  orderId: string
  betCode: string[]
}

type AddInput = Partial<OrderRow> & { issue: string; userId: string; coin: number }

export default class OrdersClass {
  lotteryId: number
  lotteryKey: string
  orders: Record<string, OrderRow[]>
  members: Record<string, number>

  constructor(lottery: { id: number, key: string }) {
    this.lotteryId = lottery.id
    this.lotteryKey = lottery.key
    this.orders = {}
    this.members = {}
    this.init()
  }
  init() {
    ; (Storage.lottery.orders as Record<string, unknown>)[this.lotteryKey] = this
  }

  add = {
    record: (data: AddInput) => {
      const issue = data.issue
      const coin = Number(data.coin)
      const payload: OrderRow = {
        issue,
        userId: String(data.userId ?? ''),
        coin,
        orderId: String(data.orderId ?? ''),
        betCode: Array.isArray(data.betCode) ? data.betCode : []
      }

      if (this.orders[issue]) this.orders[issue].push(payload)
      else {
        this.orders[issue] = []
        this.orders[issue].push(payload)
      }

      const prevCoin = Number(this.members[payload.userId] ?? 0)
      this.members[payload.userId] = prevCoin + coin

      console.log('OrdersClass.add.record', this.orders)
    }
  }

  get = {
    orders: {
      all: () => {
        return this.orders
      },
      currentIssue: (_issue: string) => {
        return this.orders[_issue]
      },
    },
    members: {
      user: (userId: string) => {
        return this.members[userId] ?? 0
      },
      issue: (_issue: string, userId: string) => {
        const filtered = this.orders[_issue]?.filter((order) => order.userId === userId) ?? []
        return filtered.reduce((acc, order) => acc + Number(order.coin), 0)
      }
    }
  }
}