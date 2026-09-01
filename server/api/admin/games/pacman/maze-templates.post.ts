import { sessionController } from '../../../../services/auth'
import { mazeTemplates, validateMazeRows } from '../../../../services/game/retro/mazeTemplates'

type Body = { name?: unknown; rows?: unknown }

export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const body = await readBody<Body>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, message: '請輸入樣板名稱。' })
  }

  const rowsInput = body?.rows
  const rows = typeof rowsInput === 'string'
    ? rowsInput.split('\n').map((r) => r.replace(/\r$/, ''))
    : Array.isArray(rowsInput) ? rowsInput.map(String) : null
  if (!rows) {
    throw createError({ statusCode: 400, message: '樣板內容格式錯誤。' })
  }

  const result = validateMazeRows(rows)
  if (!result.ok) {
    throw createError({ statusCode: 400, message: result.error })
  }

  const template = mazeTemplates.add(name, rows)
  return { template }
})
