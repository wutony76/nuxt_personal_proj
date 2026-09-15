import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 大樂透：近期開獎清單（讀 recordOpenCode，逐期結算後 push 進去；server 啟動時
 * 也會用 `DltClass._backfillHistory()` 回填最近幾期真實官方歷史，見 dlt.ts）。
 * ⚠️ 官方沒有「近N期列表」端點，回填靠反推期別字串逐期查詢，只能回填「同一民國年度」內
 * 的期數（跨年序號無法安全反推，見 `_prevOfficialPeriods()`），筆數不足時直接回傳現有筆數，
 * 不是錯誤（原本 openspec/changes/add-dlt/design.md Decision 4 認為完全無法回填，已由
 * align-dlt-issue-with-official-period 這個變更推翻——當初卡住的是不知道怎麼猜期別字串，
 * 不是端點本身不存在）。
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
