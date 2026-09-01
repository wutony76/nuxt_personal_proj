import { Storage } from '../../../storage'

/**
 * 池底重骰事件：ensurePoolBase() 觸發重骰時記錄一筆
 * before = 重骰前的 distributable（可能為 0 或低於門檻）
 * after  = 重骰後的新 poolBase
 */
export type PoolReseedEvent = {
  id: string
  lotteryKey: string
  issue: string
  before: number
  after: number
  timestamp: number
}

/**
 * 保底超付事件：結算時 naturalPerUnit < tier.minAmount 觸發時記錄一筆
 * overpay = 該獎項分層「彩池多補的差額 × 得獎者注碼總額」
 */
export type FloorOverpayEvent = {
  id: string
  lotteryKey: string
  issue: string
  overpay: number
  timestamp: number
}

function _uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

/**
 * 記錄一次池底重骰事件
 * @param lotteryKey  彩種 key（如 'K3'/'EGGS'/'KL10'）
 * @param issue       觸發時的期號
 * @param before      重骰前的 distributable 金額
 * @param after       重骰後的新 poolBase
 */
export function recordPoolReseed(lotteryKey: string, issue: string, before: number, after: number): void {
  const audit = (Storage.lottery as any).poolAudit as { reseed: PoolReseedEvent[]; overpay: FloorOverpayEvent[] }
  if (!audit) return
  audit.reseed.push({ id: _uid(), lotteryKey, issue, before, after, timestamp: Date.now() })
  if (audit.reseed.length > 2000) audit.reseed = audit.reseed.slice(-1800)
}

/**
 * 記錄一次保底超付事件
 * @param lotteryKey  彩種 key
 * @param issue       結算的期號
 * @param overpay     超出彩池預算的金額差（> 0 才有意義）
 */
export function recordFloorOverpay(lotteryKey: string, issue: string, overpay: number): void {
  if (!(overpay > 0)) return
  const audit = (Storage.lottery as any).poolAudit as { reseed: PoolReseedEvent[]; overpay: FloorOverpayEvent[] }
  if (!audit) return
  audit.overpay.push({ id: _uid(), lotteryKey, issue, overpay: Number(overpay.toFixed(2)), timestamp: Date.now() })
  if (audit.overpay.length > 2000) audit.overpay = audit.overpay.slice(-1800)
}
