import { Storage } from './storage'
import OrdersClass from './orders'

type PlayItem = {
  num?: number | string
  label?: string | number
}

export default class LOTTERY_BASE {
  // CONST
  static BASE_FIRST_PRIZE = 200000
  static JACKPOT_PERCENT = 0.8
  static BASE_PERCENT = 0.55
  static JACKPOT_BASE_MIN = Math.ceil(LOTTERY_BASE.BASE_FIRST_PRIZE / LOTTERY_BASE.BASE_PERCENT) + Math.ceil(LOTTERY_BASE.BASE_FIRST_PRIZE / 3)
  static JACKPOT_BASE_MAX = LOTTERY_BASE.BASE_FIRST_PRIZE * 7

  // FUNC
  static getOrders(id: number, key: string): OrdersClass {
    const map = Storage.lottery.orders as Record<string, OrdersClass | undefined>
    if (!map[key]) map[key] = new OrdersClass({ id, key })
    return map[key] as OrdersClass
  }
  static normalizeBetCode(play?: PlayItem): string {
    const num = Number(play?.num)
    if (Number.isFinite(num) && num > 0) return String(num).padStart(2, '0')
    return String(play?.label ?? '').trim()
  }
  static createIssue(): string {
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const seq = String((now.getHours() * 60 + now.getMinutes()) % 300).padStart(3, '0')
    return `${year}${month}${day}${seq}`
  }
  static nextSerial(map: Record<string, number>, key: string): string {
    const current = Number(map[key] ?? 0) + 1
    map[key] = current
    return String(current).padStart(6, '0')
  }
  static createOrderId(prefix: string, map: Record<string, number>, issue: string): string {
    const serial = LOTTERY_BASE.nextSerial(map, issue)
    return `${prefix}${issue}${serial}`
  }

  // JACKPOT 
  static jackpotBase(min: number = this.JACKPOT_BASE_MIN, max: number = this.JACKPOT_BASE_MAX): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  static jackpotCalc(jackpotBase: number, issuePool: number, carryJackpot: number, jackpotPercent: number = this.JACKPOT_PERCENT, basePercent: number = this.BASE_PERCENT): number {
    return Number((jackpotBase + (issuePool * jackpotPercent) + carryJackpot) * basePercent) // *0.55 才是全部的 jackpot
  }
}
