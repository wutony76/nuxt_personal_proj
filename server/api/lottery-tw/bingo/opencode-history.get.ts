import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 賓果賓果：近期開獎清單（讀 recordOpenCode，逐期結算後 push 進去；server 啟動時也會用
 * `BingoClass._bootstrapOfficialPeriod()` 種下最新一期）。
 * ⚠️ 官方沒有「近N期列表」端點，也沒有「查詢特定期別」端點（GAME_DEFS 沒有 1102 設定），
 * 賓果賓果無法回填歷史（見 bingo.ts `_bootstrapOfficialPeriod()` 說明），歷史改由每期真實
 * 結算逐步累積，上線初期筆數較少屬正常現象。
 */
export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.BINGO.key] as {
    recordOpenCode?: Array<{ issue: string; openCode: string[]; time: { start: string; end: string }; startAt: number; endAt: number }>
    drawMeta?: Record<string, { lotBigSmall: string; lotOddEven: string; superNumber: string }>
  } | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  const records = Array.isArray(game.recordOpenCode) ? game.recordOpenCode : []
  const drawMeta = game.drawMeta ?? {}
  return {
    history: [...records].reverse().map((record) => ({
      issue: record.issue,
      openCode: record.openCode,
      time: record.time,
      startAt: record.startAt,
      endAt: record.endAt,
      status: 'opened' as const,
      superNumber: drawMeta[record.issue]?.superNumber ?? '',
      lotBigSmall: drawMeta[record.issue]?.lotBigSmall ?? '',
      lotOddEven: drawMeta[record.issue]?.lotOddEven ?? ''
    }))
  }
})
