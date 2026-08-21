import { Storage } from '../../../services/storage'
import { LOTTERY, STATUS_TIME } from '~/config/constants'

/** 快樂8：開獎歷史（已開獎的期別；未開獎的當期標 pending） */
export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.KL8.key] as {
    recordOpenCode?: Array<{ issue: string; openCode: string[]; time: { start: string; end: string }; startAt: number; endAt: number }>
    currentIndex?: number
    currentStatus?: string
  } | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  const records = Array.isArray(game.recordOpenCode) ? game.recordOpenCode : []
  // 只到「已開獎」的期數為止，未開獎的期別不能把球號提前吐給前端
  const openedIndex = game.currentStatus === STATUS_TIME.OPENED
    ? Number(game.currentIndex ?? -1)
    : Number(game.currentIndex ?? 0) - 1

  return {
    history: records.slice(0, Math.max(0, openedIndex + 1)).reverse().map((record) => ({
      issue: record.issue,
      openCode: record.openCode,
      time: record.time,
      startAt: record.startAt,
      endAt: record.endAt,
      status: 'opened' as const
    }))
  }
})
