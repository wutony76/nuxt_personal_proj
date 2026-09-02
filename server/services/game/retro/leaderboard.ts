import { Storage } from '../../storage'
import RetroHistoryClass, { type RetroHistoryRecordRow } from './history'

/** @typedef {Object} RetroLeaderboardEntry */
export type RetroLeaderboardEntry = {
  rank: number
  gameKey: string
  gameName: string
  score: number
  userId: string
  userName: string
  playedAt: string
}

const DEFAULT_LIMIT = 5

/**
 * 各遊戲只取一筆「該遊戲全站最高分」（同一遊戲不重複、不做跨遊戲加總）。
 * 混排取前 N：依該遊戲「最近一局」的 playedAt 由新到舊（不是依分數高低）。
 * @param {number} [limit=5] 回傳筆數上限
 * @returns {RetroLeaderboardEntry[]} 每款遊戲至多一筆；顯示為最高分，排序為最近活躍
 */
export function getRetroLeaderboard(limit = DEFAULT_LIMIT): RetroLeaderboardEntry[] {
  const instances = Storage.retroGames.instances as Record<string, { key: string; name: string }>
  const historyMap = Storage.retroGames.history as Record<string, RetroHistoryClass>
  const accounts = Storage.get.account()

  const perGame: Array<{
    gameKey: string
    userId: string
    row: RetroHistoryRecordRow
    latestPlayedAt: string
  }> = []

  for (const gameKey of Object.keys(instances)) {
    const history = historyMap[gameKey]
    if (!history?.records) continue

    let best: { userId: string; row: RetroHistoryRecordRow } | null = null
    let latestPlayedAt = ''

    for (const [userId, rows] of Object.entries(history.records)) {
      for (const row of rows) {
        if (!latestPlayedAt || row.playedAt > latestPlayedAt) {
          latestPlayedAt = row.playedAt
        }
        if (
          !best ||
          row.score > best.row.score ||
          (row.score === best.row.score && row.playedAt > best.row.playedAt)
        ) {
          best = { userId, row }
        }
      }
    }

    if (best && latestPlayedAt) {
      perGame.push({
        gameKey,
        userId: best.userId,
        row: best.row,
        latestPlayedAt
      })
    }
  }

  return perGame
    .toSorted((a, b) => b.latestPlayedAt.localeCompare(a.latestPlayedAt))
    .slice(0, limit)
    .map(({ gameKey, userId, row }, idx) => ({
      rank: idx + 1,
      gameKey,
      gameName: row.gameName || instances[gameKey]?.name || gameKey,
      score: row.score,
      userId,
      userName: accounts[userId]?.name ?? userId,
      playedAt: row.playedAt
    }))
}
