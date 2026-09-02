export type GameSpriteAnim = 'crawl' | 'fall' | 'bounce' | 'march' | 'drift' | 'blink' | 'sparkle' | 'hop' | 'fly' | 'flip' | 'jitter'

export type GameSpriteDef = {
  key: string
  match: (upperName: string) => boolean
  icon: string
  /** 背景漂浮動畫類型，對應 GameHallSprites.vue 的 CSS class（anim-crawl／anim-fall…） */
  anim: GameSpriteAnim
  /** 該遊戲的主題色，用於裝飾元素的發光顏色，讓每個元素跟自己遊戲頁面的配色連動 */
  glow: string
}

/**
 * 各遊戲對應的圖示／背景裝飾動畫／主題色，GameMachineCard 的卡片圖示與 GameHallSprites 的
 * 背景漂浮元素共用同一份設定。未來要幫卡片本身加動畫（game-hall 視覺效果方案的第二步）時，
 * 直接讀這裡的 anim／glow 欄位套對應 CSS class 即可，不需要重新定義一次圖示對照表。
 */
export const GAME_SPRITES: GameSpriteDef[] = [
  { key: 'snake', match: (n) => n.includes('SNAKE'), icon: '🐍', anim: 'crawl', glow: '#22ff22' },
  { key: 'racing', match: (n) => n.includes('RACING'), icon: '🏎️', anim: 'fly', glow: '#67e8f9' },
  { key: 'tetriminos', match: (n) => n.includes('TETRIMINOS'), icon: '🧩', anim: 'fall', glow: '#c4b5fd' },
  { key: 'match3', match: (n) => n.includes('MATCH3'), icon: '🍬', anim: 'sparkle', glow: '#ff8a2b' },
  { key: 'pong', match: (n) => n.includes('PONG'), icon: '🏓', anim: 'bounce', glow: '#ff2ea6' },
  { key: 'runner', match: (n) => n.includes('RUNNER'), icon: '🏃', anim: 'hop', glow: '#ffd400' },
  { key: 'spaceShooter', match: (n) => n.includes('SPACE SHOOTER'), icon: '🚀', anim: 'fly', glow: '#4d7fff' },
  { key: 'minesweeper', match: (n) => n.includes('MINESWEEPER'), icon: '💣', anim: 'blink', glow: '#39d98a' },
  { key: 'pacman', match: (n) => n.includes('PAC-MAN'), icon: '👻', anim: 'drift', glow: '#ffd83b' },
  { key: 'spaceInvaders', match: (n) => n.includes('SPACE INVADERS'), icon: '👾', anim: 'march', glow: '#ff3b3b' },
  { key: 'solitaire', match: (n) => n.includes('SOLITAIRE'), icon: '🃏', anim: 'flip', glow: '#2ecc71' },
  { key: 'typing', match: (n) => n.includes('TYPING'), icon: '⌨️', anim: 'jitter', glow: '#ffb627' },
  { key: 'breakout', match: (n) => n.includes('BREAKOUT'), icon: '🧱', anim: 'bounce', glow: '#1de9b6' },
  { key: 'orbMatch', match: (n) => n.includes('ORB MATCH'), icon: '🔮', anim: 'sparkle', glow: '#9d4edd' },
  { key: 'battleship', match: (n) => n.includes('BATTLESHIP'), icon: '🚢', anim: 'drift', glow: '#3a86ff' },
  { key: '2048', match: (n) => n.includes('2048'), icon: '🔢', anim: 'bounce', glow: '#f4a261' },
  { key: 'flappy', match: (n) => n.includes('FLAPPY'), icon: '🐤', anim: 'hop', glow: '#06d6a0' },
  { key: 'frogger', match: (n) => n.includes('FROGGER'), icon: '🐸', anim: 'hop', glow: '#52b788' },
  { key: 'connect4', match: (n) => n.includes('CONNECT 4'), icon: '🔴', anim: 'fall', glow: '#e63946' },
  { key: 'whackAMole', match: (n) => n.includes('WHACK-A-MOLE'), icon: '🐹', anim: 'hop', glow: '#a0522d' },
  { key: 'lightsOut', match: (n) => n.includes('LIGHTS OUT'), icon: '💡', anim: 'blink', glow: '#adb5bd' },
  { key: 'towerStack', match: (n) => n.includes('TOWER STACK'), icon: '🗼', anim: 'fall', glow: '#118ab2' }
]

const DEFAULT_SPRITE: GameSpriteDef = { key: 'default', match: () => true, icon: '🎮', anim: 'drift', glow: '#00e5ff' }

export const resolveGameSprite = (name: string): GameSpriteDef => {
  const upper = name.toUpperCase()
  return GAME_SPRITES.find((sprite) => sprite.match(upper)) ?? DEFAULT_SPRITE
}
