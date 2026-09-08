/**
 * 「角色 x 遊戲權限」用的 route slug ↔ 權限 key 對照表（見
 * openspec/changes/add-role-game-perms/design.md Decision 3）。
 *
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared`／`~` 別名，
 *    只要設定檔內出現這類 import，伺端一載入就會炸
 *    「Package import specifier "#shared/..." is not defined」。
 *
 * retro（遊戲中心）：`pageSlug` 是前台 `/game/:slug` 的路由 slug，`apiSlug` 是後端
 * `/api/games/retro/:slug/*` 的路徑 slug——兩者拼法不一定相同（例如 `lightsOut` 這款，
 * 前台頁面是 `lights-out`、後端路由資料夾是 `lightsOut`），`key` 才是兩邊真正共用、
 * 用來查 `Storage.retroGames.instances` 與角色權限的鍵值。
 */
export const RETRO_GAMES = [
  { key: 'snake', pageSlug: 'snake', apiSlug: 'snake' },
  { key: 'racing', pageSlug: 'racing', apiSlug: 'racing' },
  { key: 'tetriminos', pageSlug: 'tetriminos', apiSlug: 'tetriminos' },
  { key: 'match3rush', pageSlug: 'match3-rush', apiSlug: 'match3rush' },
  { key: 'match3classic', pageSlug: 'match3-classic', apiSlug: 'match3classic' },
  { key: 'pong', pageSlug: 'pong', apiSlug: 'pong' },
  { key: 'runner', pageSlug: 'runner', apiSlug: 'runner' },
  { key: 'spaceShooter', pageSlug: 'space-shooter', apiSlug: 'space-shooter' },
  { key: 'minesweeper', pageSlug: 'minesweeper', apiSlug: 'minesweeper' },
  { key: 'pacman', pageSlug: 'pac-man', apiSlug: 'pac-man' },
  { key: 'spaceInvaders', pageSlug: 'space-invaders', apiSlug: 'space-invaders' },
  { key: 'solitaire', pageSlug: 'solitaire', apiSlug: 'solitaire' },
  { key: 'typing', pageSlug: 'typing', apiSlug: 'typing' },
  { key: 'breakout', pageSlug: 'breakout', apiSlug: 'breakout' },
  { key: 'orbMatch', pageSlug: 'orb-match', apiSlug: 'orb-match' },
  { key: 'battleship', pageSlug: 'battleship', apiSlug: 'battleship' },
  { key: '2048', pageSlug: '2048', apiSlug: '2048' },
  { key: 'flappy', pageSlug: 'flappy', apiSlug: 'flappy' },
  { key: 'frogger', pageSlug: 'frogger', apiSlug: 'frogger' },
  { key: 'connect4', pageSlug: 'connect4', apiSlug: 'connect4' },
  { key: 'whackAMole', pageSlug: 'whack-a-mole', apiSlug: 'whack-a-mole' },
  { key: 'lightsOut', pageSlug: 'lights-out', apiSlug: 'lightsOut' },
  { key: 'towerStack', pageSlug: 'tower-stack', apiSlug: 'tower-stack' },
  { key: 'arkanoid', pageSlug: 'arkanoid', apiSlug: 'arkanoid' },
  { key: 'towerDefense', pageSlug: 'tower-defense', apiSlug: 'tower-defense' },
  { key: 'pinball', pageSlug: 'pinball', apiSlug: 'pinball' },
  { key: 'colorMatch', pageSlug: 'color-match', apiSlug: 'color-match' },
  { key: 'maze', pageSlug: 'maze', apiSlug: 'maze' },
  { key: 'bubbleShooter', pageSlug: 'bubble-shooter', apiSlug: 'bubble-shooter' },
  { key: 'cutTheRope', pageSlug: 'cut-the-rope', apiSlug: 'cut-the-rope' }
]

/**
 * bg（BG 彩票）：權限已經是盤口層級（見 design.md Decision 1），`key` 直接對應
 * `app/config/constants.js` 的 `LOTTERY` key，同時也是 `POST /api/lottery/bet`
 * 下注時 `payload.lottery.key` 的值，不需要另外的 apiSlug——沒有「每個盤口一個 API 路由」
 * 這回事，下注一律打同一個共用端點。
 */
export const BG_GAMES = [
  { key: 'LHC-CD', pageSlug: '6hc-cd' },
  { key: 'LHC-OF', pageSlug: '6hc-of' },
  { key: 'K3-CD', pageSlug: 'k3-cd' },
  { key: 'K3-OF', pageSlug: 'k3-of' },
  { key: 'PK10-CD', pageSlug: 'pk10-cd' },
  { key: 'PK10-OF', pageSlug: 'pk10-of' },
  { key: 'SSC-CD', pageSlug: 'ssc-cd' },
  { key: 'SSC-OF', pageSlug: 'ssc-of' },
  { key: 'X5-CD', pageSlug: '11x5-cd' },
  { key: 'X5-OF', pageSlug: '11x5-of' },
  { key: 'EGGS', pageSlug: 'egg' },
  { key: 'KL10', pageSlug: 'kl10' },
  { key: 'KL8', pageSlug: 'kl8' },
  { key: 'FC3D', pageSlug: 'fc3d' },
  { key: 'PL3', pageSlug: 'pl3' }
]

export function findRetroByApiSlug(slug) {
  return RETRO_GAMES.find((g) => g.apiSlug === slug)
}

export function findRetroByPageSlug(slug) {
  return RETRO_GAMES.find((g) => g.pageSlug === slug)
}

export function findBgByPageSlug(slug) {
  return BG_GAMES.find((g) => g.pageSlug === slug)
}
