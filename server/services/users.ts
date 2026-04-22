import { Storage } from './storage'

export default class Users {
  userId: string
  coin: number

  constructor(userId: string) {
    this.userId = userId
    this.coin = 100000
    this.init()
  }

  init() {
    Storage.users[this.userId] = this
  }
}