import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 威力彩：近期開獎清單（讀 recordOpenCode，逐期結算後 push 進去；server 啟動時也會用
 * `SuperlottoClass._backfillHistory()` 回填最近幾期真實官方歷史，見 superlotto.ts）。
 * openCode 為 7 碼（第一區排序後 6 碼＋第二區 1 碼，第二區固定最後一碼）。
 */
export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.SUPERLOTTO.key] as {
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
