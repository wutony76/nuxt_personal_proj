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
 * 彙整所有遊戲紀錄，依 playedAt 由新到舊取前 N 筆（各筆仍為單局分數，不做跨遊戲加總）。
 * @param {number} [limit=5] 回傳筆數上限
 * @returns {RetroLeaderboardEntry[]} 依遊戲時間由新到舊排序的紀錄
 */
export function getRetroLeaderboard(limit = DEFAULT_LIMIT): RetroLeaderboardEntry[] {
  const instances = Storage.retroGames.instances as Record<string, { key: string; name: string }>
  const historyMap = Storage.retroGames.history as Record<string, RetroHistoryClass>
  const accounts = Storage.get.account()

  const allRows: Array<{ gameKey: string; userId: string; row: RetroHistoryRecordRow }> = []

  for (const gameKey of Object.keys(instances)) {
    const history = historyMap[gameKey]
    if (!history?.records) continue

    for (const [userId, rows] of Object.entries(history.records)) {
      for (const row of rows) {
        allRows.push({ gameKey, userId, row })
      }
    }
  }

  return allRows
    .toSorted((a, b) => b.row.playedAt.localeCompare(a.row.playedAt))
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
