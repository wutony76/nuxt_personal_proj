import { Storage } from './storage'

export default class Users {
  COIN: number

  constructor(userId: string) {
    this.userId = userId
    this.COIN = 100000
    this.init()
  }

  init() {
    Storage.users[this.userId] = this
  }
}