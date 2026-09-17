import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 39樂合彩：近期開獎清單（讀 recordOpenCode，逐期結算後 push 進去；server 啟動時也會用
 * `M539Class._bootstrapOfficialPeriod()` 種下最新一期）。
 * ⚠️ 官方沒有「近N期列表」端點；共用的 `fetchTaiwanLotteryDrawOf` 內部硬性要求 lotNumber 至少
 * 7 碼（DLT 6＋1 特別號），39樂合彩一期只有 5 碼，因此回填對 M539 等於無效（見 m539.ts
 * `_backfillHistory()` 說明），歷史改由每期真實結算逐步累積，屬正常現象。
 */
export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.M539.key] as {
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
