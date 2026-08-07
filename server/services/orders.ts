import { Storage } from './storage'
import type { CreditLianmaTier } from '#shared/config/6hc-cd'

type OrderRow = {
  issue: string
  userId: string
  coin: number
  orderId: string
  betCode: string[]
  tabId?: number
  /** 玩法 key（tema / zhengma…），結算時用來分派各玩法的中獎判定 */
  playKey?: string
  /** 下注時鎖定的賠率（含本金），結算派彩以此為準（A/B 盤賠率不同） */
  odds?: number
  /**
   * 連碼：下注時鎖定的命中檔次表（中三 / 中二…）
   * 一注有多種中法、賠率開獎後才確定，單一 odds 不夠用，故整份快照
   */
  tiers?: CreditLianmaTier[]
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
      const tabId = Number(data.tabId)
      const payload: OrderRow = {
        issue,
        userId: String(data.userId ?? ''),
        coin,
        orderId: String(data.orderId ?? ''),
        betCode: Array.isArray(data.betCode) ? data.betCode : [],
        tabId: Number.isFinite(tabId) && tabId > 0 ? tabId : 0,
        playKey: String(data.playKey ?? ''),
        odds: Number(data.odds ?? 0),
        ...(Array.isArray(data.tiers) && data.tiers.length > 0 ? { tiers: data.tiers } : {})
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
    /** 同一玩家、同一期、同一分頁的累計投注額（單期限額驗證用） */
    issueTabCoin: (_issue: string, userId: string, tabId: number) => {
      const id = Number(tabId)
      return (this.orders[_issue] ?? [])
        .filter((order) => order.userId === userId && Number(order.tabId) === id)
        .reduce((acc, order) => acc + Number(order.coin ?? 0), 0)
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