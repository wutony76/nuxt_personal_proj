import currentGet from '../api/lottery/6hc-of/current.get'
import meGet from '../api/me.get'
import { Storage } from './storage'

export default class OrdersClass {
  constructor(lottery: { id: number, key: string }) {
    this.lotteryId = lottery.id
    this.lotteryKey = lottery.key
    this.orders = {}
    this.members = {}
    this.init()
  }
  init() {
    Storage.lottery.orders[this.lotteryKey] = this
  }

  add = {
    record: (data) => {
      const issue = data.issue
      const coin = Number(data.coin)

      if (Object.hasOwn(this.orders, issue)) this.orders[issue].push(data)
      else {
        this.orders[issue] = []
        this.orders[issue].push(data)
      }

      if (Object.hasOwn(this.members, data.userId)) this.members[data.userId] += coin
      else this.members[data.userId] = coin

      console.log('OrdersClass.add.record', this.orders)
    }
  }

  get = {
    orders: {
      all: () => {
        return this.orders
      },
      currentIssue: (_issue) => {
        return this.orders[_issue]
      },
    },
    members: {
      user: (userId) => {
        return this.members[userId] ?? 0
      },
      issue: (_issue, userId) => {
        const filtered = this.orders[_issue]?.filter((order) => order.userId === userId) ?? []
        return filtered.reduce((acc, order) => acc + Number(order.coin), 0)
      }
    }
  }
}