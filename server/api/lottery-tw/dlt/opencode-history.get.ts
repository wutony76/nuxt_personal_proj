import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 大樂透：近期開獎清單（讀 recordOpenCode，逐期結算後才會 push 進去）。
 * ⚠️ 筆數依本站上線後累積的期數而定，上線初期不足時直接回傳現有筆數，不是錯誤
 * （官方沒有「近N期列表」端點可回填，見 openspec/changes/add-dlt/design.md Decision 4）。
 */
export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.DLT.key] as {
    recordOpenCode?: Array<{ issue: string; openCode: string[]; time: { start: string; end: string }; startAt: number; endAt: number }>
  } | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  const records = Array.isArray(game.recordOpenCode) ? game.recordOpenCode : []
  return {
    history: [...records].reverse().map((record) => ({
      issue: record.issue,
      openCode: record.openCode,
      time: record.time,
      startAt: record.startAt,
      endAt: record.endAt,
      status: 'opened' as const
    }))
  }
})
