import { Storage } from '../../storage'

/**
 * PAC-MAN 固定樣板迷宮，從 client 端程式碼常數搬到 server 端可變狀態（見
 * openspec/changes/add-admin-backend/design.md Decision 5）。連通性驗證邏輯
 * 是從 app/pages/game/pac-man.vue 原本的 isMazeFullyConnected()／parseFixedTemplate()
 * 搬過來的同一套演算法，維度常數（COLS/ROWS/TUNNEL_ROW/出生點）也必須跟該檔案的
 * PacManEngine 保持一致，這幾個常數目前是各自獨立維護（server 端沒有 import client 端的
 * .vue 檔案），修改任一邊的迷宮尺寸都要記得同步另一邊。
 */
export type MazeTemplate = { id: string; name: string; rows: string[] }
type Pos = { x: number; y: number }
type Dir = 'up' | 'down' | 'left' | 'right'

const COLS = 19
const ROWS = 21
const TUNNEL_ROW = 10
const PAC_SPAWN: Pos = { x: 9, y: 17 }
const GHOST_SPAWNS: Pos[] = [
  { x: 8, y: 9 },
  { x: 10, y: 9 },
  { x: 8, y: 11 },
  { x: 10, y: 11 }
]
const HOME_CORNERS: Pos[] = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
  { x: COLS - 2, y: ROWS - 2 }
]
const DIR_DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
}

export const DEFAULT_MAZE_TEMPLATES: MazeTemplate[] = [
  {
    id: 'classic-01',
    name: 'classic-01',
    rows: [
      '###################',
      '#.................#',
      '#...#.#...#...#.#.#',
      '#.................#',
      '#.....#.#.....#.#.#',
      '#.................#',
      '#.#.#...#...#.#...#',
      '#.................#',
      '#.#.#...#.#.#...#.#',
      '#.................#',
      '...................',
      '#.................#',
      '#.#.#.#.#...#...#.#',
      '#.................#',
      '#...#.#...........#',
      '#.................#',
      '#.#.#.#...#.#.#.#.#',
      '#.................#',
      '#.......#...#...#.#',
      '#.................#',
      '###################'
    ]
  }
]

type Grid = ('wall' | 'floor')[][]

function toGrid(rows: string[]): Grid {
  return rows.map((line) => line.split('').map((ch) => (ch === '#' ? 'wall' : 'floor')))
}

/** 從 Pac-Man 出生點對整張迷宮做 BFS，確認每一格通道皆可抵達 */
function isMazeFullyConnected(grid: Grid): boolean {
  const visited = new Set<string>()
  const stack: Pos[] = [{ ...PAC_SPAWN }]
  visited.add(`${PAC_SPAWN.x},${PAC_SPAWN.y}`)
  while (stack.length > 0) {
    const cur = stack.pop()!
    ;(Object.keys(DIR_DELTA) as Dir[]).forEach((dir) => {
      const delta = DIR_DELTA[dir]
      let nx = cur.x + delta.x
      const ny = cur.y + delta.y
      if (ny === TUNNEL_ROW) {
        if (nx < 0) nx = COLS - 1
        if (nx >= COLS) nx = 0
      }
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return
      if (grid[ny]?.[nx] === 'wall') return
      const key = `${nx},${ny}`
      if (visited.has(key)) return
      visited.add(key)
      stack.push({ x: nx, y: ny })
    })
  }
  let totalFloor = 0
  grid.forEach((row) => row.forEach((c) => {
    if (c !== 'wall') totalFloor += 1
  }))
  return visited.size === totalFloor
}

/**
 * 驗證一份樣板的 rows：尺寸、字元、邊界、穿隧口、連通性，回傳明確的錯誤訊息供後台 UI 顯示；
 * 通過驗證才允許存檔，不接受任何會讓玩家卡關的壞版面。
 */
export function validateMazeRows(rows: string[]): { ok: true } | { ok: false; error: string } {
  if (rows.length !== ROWS) return { ok: false, error: `需要 ${ROWS} 列，目前 ${rows.length} 列。` }
  if (rows.some((line) => line.length !== COLS)) {
    return { ok: false, error: `每一列的長度都必須是 ${COLS} 字元。` }
  }
  if (rows.some((line) => /[^#.]/.test(line))) {
    return { ok: false, error: '只允許 # （牆）與 . （通道，任何非 # 字元皆視為通道）兩種字元。' }
  }

  const grid = toGrid(rows)
  for (let x = 0; x < COLS; x += 1) {
    if (grid[0]![x] !== 'wall' || grid[ROWS - 1]![x] !== 'wall') {
      return { ok: false, error: '上下邊界必須全部是牆。' }
    }
  }
  for (let y = 0; y < ROWS; y += 1) {
    const isTunnelMouth = y === TUNNEL_ROW
    const leftIsWall = grid[y]![0] === 'wall'
    const rightIsWall = grid[y]![COLS - 1] === 'wall'
    if (isTunnelMouth ? leftIsWall || rightIsWall : !leftIsWall || !rightIsWall) {
      return { ok: false, error: `左右邊界必須是牆，唯獨第 ${TUNNEL_ROW} 列（穿隧列）的左右兩端必須是通道。` }
    }
  }

  HOME_CORNERS.forEach((p) => {
    grid[p.y]![p.x] = 'floor'
  })
  ;[PAC_SPAWN, ...GHOST_SPAWNS].forEach((p) => {
    grid[p.y]![p.x] = 'floor'
  })

  if (!isMazeFullyConnected(grid)) {
    return { ok: false, error: '連通性驗證失敗：部分通道無法從 Pac-Man 出生點抵達，此樣板不可儲存。' }
  }
  return { ok: true }
}

export const mazeTemplates = {
  list: (): MazeTemplate[] => Storage.retroGames.pacmanMazeTemplates,
  add: (name: string, rows: string[]): MazeTemplate => {
    const template: MazeTemplate = { id: `m${Date.now()}${Math.random().toString(16).slice(2, 6)}`, name, rows }
    Storage.retroGames.pacmanMazeTemplates.push(template)
    return template
  },
  remove: (id: string): boolean => {
    const before = Storage.retroGames.pacmanMazeTemplates.length
    Storage.retroGames.pacmanMazeTemplates = Storage.retroGames.pacmanMazeTemplates.filter((t) => t.id !== id)
    return Storage.retroGames.pacmanMazeTemplates.length < before
  }
}
