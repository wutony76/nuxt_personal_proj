import { Storage } from 'serv/services/storage'
import type { PoolReseedEvent, FloorOverpayEvent } from 'serv/services/game/lottery/bg/poolAudit'

export type AdminPoolAuditRow = (PoolReseedEvent | FloorOverpayEvent) & { lotteryName: string; timeStr: string }
export type AdminPoolAuditSummary = { key: string; name: string; reseedCount: number; totalOverpay: number }
export type AdminPoolAuditResult = {
  reseed: AdminPoolAuditRow[]
  overpay: AdminPoolAuditRow[]
  summary: AdminPoolAuditSummary[]
  stats: { reseedCount: number; overpayCount: number; totalOverpay: number }
}

/** 彩種顯示名對照 */
const LOTTERY_NAMES: Record<string, string> = {
  'LHC-OF': '六合彩', 'LHC-CD': '六合彩(CD)',
  'K3': '快3', 'K3-OF': '快3', 'K3-CD': '快3(CD)',
  'PK10': 'PK10', 'PK10-OF': 'PK10', 'PK10-CD': 'PK10(CD)',
  'SSC': '時時彩', 'SSC-OF': '時時彩', 'SSC-CD': '時時彩(CD)',
  'X5': '11選5', 'X5-OF': '11選5', 'X5-CD': '11選5(CD)',
  'EGGS': 'PC蛋蛋', 'KL10': '快樂十分', 'KL8': '快樂8',
  'FC3D': '福彩3D', 'PL3': '排列3'
}

/**
 * 池底重骰事件的權威 key 清單（10 種彩種，見 design.md Decision 3）：
 * K3／PK10／SSC／X5 的 CD／OF 共用同一份池，`recordPoolReseed()` 一律記在不分 CD/OF 的裸 key
 * 上（見各自 xxxShared.ts 的 `xxxEnsurePoolBase()`），不是 15 個頁面 key 各自一份；
 * 六合彩（LHC）沒有門檻重骰機制（彩池是純餘額結轉），只用 'LHC-OF' 代表、恆為 0 次。
 * 與前台 `app/pages/admin/bg-lottery.vue` 的 `LOTTERY_KEYS` 篩選下拉保持一致。
 */
const POOL_AUDIT_KEYS = ['LHC-OF', 'K3', 'PK10', 'SSC', 'X5', 'EGGS', 'KL10', 'KL8', 'FC3D', 'PL3']

function _filterByTime(ts: number, range: string): boolean {
  if (range === 'all') return true
  const now = Date.now()
  const days = range === '7d' ? 7 : 30
  return ts >= now - days * 24 * 60 * 60 * 1000
}

function _formatTs(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * 後台：BG 彩票彩池補貼追蹤（池底重骰＋保底超付事件）。
 */
export const adminPoolAuditService = {
  /**
   * @param lotteryKey 篩選彩種 key（可選，空字串＝全部）
   * @param range 時間區間：7d / 30d / all（預設 all）
   * @returns 池底重骰＋保底超付事件列表、各彩種摘要統計
   */
  list: (lotteryKey: string, range: string): AdminPoolAuditResult => {
    const audit = (Storage.lottery as any).poolAudit as { reseed: PoolReseedEvent[]; overpay: FloorOverpayEvent[] }

    const reseed = [...(audit?.reseed ?? [])]
      .filter((e) => (!lotteryKey || e.lotteryKey === lotteryKey) && _filterByTime(e.timestamp, range))
      .sort((a, b) => b.timestamp - a.timestamp)

    const overpay = [...(audit?.overpay ?? [])]
      .filter((e) => (!lotteryKey || e.lotteryKey === lotteryKey) && _filterByTime(e.timestamp, range))
      .sort((a, b) => b.timestamp - a.timestamp)

    const totalOverpay = Number(overpay.reduce((sum, e) => sum + Number(e.overpay), 0).toFixed(2))
    const reseedCount = reseed.length
    const overpayCount = overpay.length

    /**
     * 各彩種的統計摘要：先把 10 種彩種（或篩選中的單一種）都以 0 次墊底，
     * 避免「這次伺服器啟動後剛好還沒觸發過」被誤看成「這個彩種不支援池底重骰」
     */
    const summaryMap = new Map<string, AdminPoolAuditSummary>()
    const _ensureKey = (key: string) => {
      if (!summaryMap.has(key)) summaryMap.set(key, { key, name: LOTTERY_NAMES[key] ?? key, reseedCount: 0, totalOverpay: 0 })
      return summaryMap.get(key)!
    }
    POOL_AUDIT_KEYS
      .filter((key) => !lotteryKey || key === lotteryKey)
      .forEach((key) => _ensureKey(key))
    reseed.forEach((e) => { _ensureKey(e.lotteryKey).reseedCount++ })
    overpay.forEach((e) => {
      const row = _ensureKey(e.lotteryKey)
      row.totalOverpay = Number((row.totalOverpay + e.overpay).toFixed(2))
    })

    const summary = [...summaryMap.values()]

    return {
      reseed: reseed.map((e) => ({ ...e, lotteryName: LOTTERY_NAMES[e.lotteryKey] ?? e.lotteryKey, timeStr: _formatTs(e.timestamp) })),
      overpay: overpay.map((e) => ({ ...e, lotteryName: LOTTERY_NAMES[e.lotteryKey] ?? e.lotteryKey, timeStr: _formatTs(e.timestamp) })),
      summary,
      stats: { reseedCount, overpayCount, totalOverpay }
    }
  }
}
