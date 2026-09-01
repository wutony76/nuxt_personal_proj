import { mazeTemplates } from '../../../../services/game/retro/mazeTemplates'

/**
 * 公開端點：所有玩家（含訪客）開局時都要 fetch 這份清單來混入隨機生成的迷宮池，
 * 不是只有管理員能看，比照既有 /api/games/retro/rates 的公開模式，
 * 見 server/middleware/auth.ts 的 PUBLIC_GAME_PATHS。
 */
export default defineEventHandler(() => {
  return { templates: mazeTemplates.list() }
})
