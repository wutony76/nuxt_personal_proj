import { socketHub } from '../../social/socketHub'
import { getRetroLeaderboard } from './leaderboard'

/**
 * retro 得分結算後推播最新排行榜，讓 /game-hall 的 SCORE.RANK 面板即時更新，
 * 不用等使用者自己重新整理頁面才看得到（比照既有 system:broadcast 的作法，
 * 見 server/services/social/broadcastService.ts）。
 *
 * 刻意獨立一個檔案、不讓 base.ts 直接 import socketHub：維持跟 chatService.ts 一樣的
 * 「業務邏輯不知道要不要廣播，由呼叫端決定」分層，socketHub 只在這一支薄薄的橋接檔案出現。
 */
export const retroLeaderboardBroadcast = {
  push: () => {
    socketHub.broadcast('retro:leaderboard', { entries: getRetroLeaderboard() })
  }
}
