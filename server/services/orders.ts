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

    }
  }
}