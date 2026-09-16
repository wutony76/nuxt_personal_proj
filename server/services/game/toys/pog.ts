import { ToyPlayError, type ToyWalletPort } from './luckyDraw.ts'
import { acquireLock, clearPool, readPool, releaseLock, writePool } from './pool.ts'
import { applyMultiplier, isValidBet } from './reward.ts'

export type PogKind = 'number' | 'king' | 'shield' | 'swap' | 'bomb'
export type PogCard = { id: string; rank: number; kind: PogKind }
export type PogTrickResult = 'player' | 'npc' | 'cancel' | 'tie'

export type PogMeta = {
  player: PogCard[]
  npc: PogCard[]
  remainder: PogCard[]
  playerWins: number
  npcWins: number
  kingUsed: boolean
  bombPending: boolean
  tricks: Array<{ player: string; npc: string; result: PogTrickResult }>
}

export type PogView = {
  status: 'idle' | 'result'
  hand: PogCard[]
  npcCount: number
  last: { player: PogCard; npc: PogCard; result: PogTrickResult } | null
  playerWins: number
  npcWins: number
  reward: number
  multiplier: number
  balance: number
  settled: boolean
  canPlay: boolean
  gameKey: string | null
  blocked: boolean
}

const GAME_KEY = 'pog'

/**
 * @returns 1–8 與王、盾、換、炸各一張
 */
export function freshPogDeck(): PogCard[] {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8].map((rank) => ({ id: String(rank), rank, kind: 'number' as const }))
  return [
    ...numbers,
    { id: 'king', rank: 9, kind: 'king' },
    { id: 'shield', rank: 0, kind: 'shield' },
    { id: 'swap', rank: 0, kind: 'swap' },
    { id: 'bomb', rank: 0, kind: 'bomb' }
  ]
}

/**
 * @param rng 洗牌用
 * @returns 洗好的 12 張
 */
export function shufflePog(rng: () => number): PogCard[] {
  const deck = freshPogDeck()
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.min(index, Math.floor(rng() * (index + 1)))
    const current = deck[index] as PogCard
    deck[index] = deck[swap] as PogCard
    deck[swap] = current
  }
  return deck
}

/**
 * @param deck 已洗好的 12 張
 * @returns 雙方各 5 張，剩下 2 張只給重抽
 */
export function dealPog(deck: PogCard[]): Pick<PogMeta, 'player' | 'npc' | 'remainder'> {
  return {
    player: deck.slice(0, 5),
    npc: deck.slice(5, 10),
    remainder: deck.slice(10, 12)
  }
}

function readMeta(userId: string): PogMeta | null {
  const pool = readPool(userId)
  if (!pool || pool.gameKey !== GAME_KEY || !pool.meta) return null
  return pool.meta as PogMeta
}

function viewOf(input: {
  balance: number
  meta: PogMeta | null
  last: PogView['last']
  reward: number
  multiplier: number
  settled: boolean
  gameKey: string | null
  blocked: boolean
}): PogView {
  return {
    status: input.meta || input.settled ? 'result' : 'idle',
    hand: input.meta?.player ?? [],
    npcCount: input.meta?.npc.length ?? 0,
    last: input.last,
    playerWins: input.meta?.playerWins ?? 0,
    npcWins: input.meta?.npcWins ?? 0,
    reward: input.reward,
    multiplier: input.multiplier,
    balance: input.balance,
    settled: input.settled,
    canPlay: Boolean(input.meta) && !input.settled,
    gameKey: input.gameKey,
    blocked: input.blocked
  }
}

/**
 * @param userId 帳號 id
 * @param balance 目前 F 幣
 * @returns 尪仔標畫面
 */
export function snapshotPog(userId: string, balance: number): PogView {
  const pool = readPool(userId)
  const meta = readMeta(userId)
  return viewOf({
    balance,
    meta,
    last: null,
    reward: 0,
    multiplier: 0,
    settled: false,
    gameKey: pool?.gameKey ?? null,
    blocked: pool != null && pool.gameKey !== GAME_KEY
  })
}

function take(cards: PogCard[], id: string): { card: PogCard; rest: PogCard[] } | null {
  const index = cards.findIndex((card) => card.id === id)
  if (index < 0) return null
  return { card: cards[index] as PogCard, rest: cards.filter((card) => card.id !== id) }
}

function redraw(card: PogCard, rest: PogCard[], remainder: PogCard[], rng: () => number): { card: PogCard; rest: PogCard[]; remainder: PogCard[] } {
  if (card.kind !== 'swap' || remainder.length === 0) return { card, rest, remainder }
  const index = Math.min(remainder.length - 1, Math.floor(rng() * remainder.length))
  const drawn = remainder[index] as PogCard
  return {
    card: drawn,
    rest: [...rest, drawn].filter((item, itemIndex, list) => list.findIndex((candidate) => candidate.id === item.id) === itemIndex && item.id !== card.id),
    remainder: remainder.filter((item) => item.id !== drawn.id)
  }
}

function rankOf(card: PogCard, penalized: boolean): number {
  if (!penalized || card.kind !== 'number') return card.rank
  return Math.max(0, card.rank - 2)
}

/**
 * @param input.action 發牌或出牌
 * @returns 已決定的手牌或這一回合
 */
export function playPog(input: {
  userId: string
  action: 'start' | 'play'
  bet?: number
  cardId?: string
  deck?: PogCard[]
  balance: number
  rng: () => number
  wallet: ToyWalletPort
}): PogView {
  if (!acquireLock(input.userId)) throw new ToyPlayError(409, '這一局還在結算，請稍等。')
  try {
    if (input.action === 'play') return _play(input)
    return _start(input)
  } finally {
    releaseLock(input.userId)
  }
}

function _start(input: { userId: string; bet?: number; deck?: PogCard[]; balance: number; rng: () => number; wallet: ToyWalletPort }): PogView {
  const bet = Number(input.bet)
  if (!isValidBet(bet)) throw new ToyPlayError(400, '注額必須是 1 以上的整數。')
  if (readPool(input.userId)) throw new ToyPlayError(400, '還有未結束的玩具，不能另開一局。')
  const dealt = dealPog(input.deck ?? shufflePog(input.rng))
  let balance = input.balance
  try {
    balance = input.wallet.debit(input.userId, bet, `尪仔標下注 ${bet}`)
  } catch {
    throw new ToyPlayError(400, '餘額不足，無法扣款。')
  }
  const meta: PogMeta = {
    ...dealt,
    playerWins: 0,
    npcWins: 0,
    kingUsed: false,
    bombPending: false,
    tricks: []
  }
  writePool({ userId: input.userId, unclaimed: 0, gameKey: GAME_KEY, bet, claimed: false, meta })
  return viewOf({ balance, meta, last: null, reward: 0, multiplier: 0, settled: false, gameKey: GAME_KEY, blocked: false })
}

function _play(input: { userId: string; cardId?: string; balance: number; rng: () => number; wallet: ToyWalletPort }): PogView {
  const pool = readPool(input.userId)
  const meta = readMeta(input.userId)
  if (!pool || !meta) throw new ToyPlayError(400, '請先開始尪仔標。')
  if (meta.tricks.length >= 5) throw new ToyPlayError(400, '這五回合已經打完。')
  const picked = take(meta.player, input.cardId ?? '')
  if (!picked) throw new ToyPlayError(400, '這張牌不在手上。')

  let playerCard = picked.card
  let playerRest = picked.rest
  let remainder = meta.remainder.slice()
  if (playerCard.kind === 'swap') {
    const redrawn = redraw(playerCard, playerRest, remainder, input.rng)
    playerCard = redrawn.card
    playerRest = playerRest.filter((card) => card.id !== redrawn.card.id)
    remainder = redrawn.remainder
  }

  const npcIndex = Math.min(meta.npc.length - 1, Math.floor(input.rng() * meta.npc.length))
  let npcCard = meta.npc[npcIndex] as PogCard
  let npcRest = meta.npc.filter((card) => card.id !== npcCard.id)
  if (npcCard.kind === 'swap') {
    const redrawn = redraw(npcCard, npcRest, remainder, input.rng)
    npcCard = redrawn.card
    npcRest = npcRest.filter((card) => card.id !== npcCard.id)
    remainder = redrawn.remainder
  }

  const npcRank = rankOf(npcCard, meta.bombPending)
  const playerRank = playerCard.rank
  let result: PogTrickResult = 'tie'
  if (playerCard.kind === 'shield' && playerRank < npcRank) result = 'cancel'
  else if (playerRank > npcRank) result = 'player'
  else if (playerRank < npcRank) result = 'npc'

  const next: PogMeta = {
    player: playerRest,
    npc: npcRest,
    remainder,
    playerWins: meta.playerWins + (result === 'player' ? 1 : 0),
    npcWins: meta.npcWins + (result === 'npc' ? 1 : 0),
    kingUsed: meta.kingUsed || (result === 'player' && playerCard.kind === 'king'),
    bombPending: playerCard.kind === 'bomb',
    tricks: [...meta.tricks, { player: playerCard.id, npc: npcCard.id, result }]
  }
  const last = { player: playerCard, npc: { ...npcCard, rank: npcRank }, result }
  if (next.tricks.length < 5) {
    writePool({ ...pool, meta: next })
    return viewOf({ balance: input.balance, meta: next, last, reward: 0, multiplier: 0, settled: false, gameKey: GAME_KEY, blocked: false })
  }

  const won = next.playerWins > next.npcWins
  const tied = next.playerWins === next.npcWins
  const multiplier = won ? (next.kingUsed ? 3.8 : 1.9) : 0
  const reward = tied ? pool.bet : (won ? applyMultiplier(applyMultiplier(pool.bet, 1.9), next.kingUsed ? 2 : 1) : 0)
  let balance = input.balance
  if (reward > 0) balance = input.wallet.credit(input.userId, reward, `尪仔標結算 ${reward}`)
  clearPool(input.userId)
  return viewOf({
    balance,
    meta: { ...next, player: [], npc: [] },
    last,
    reward,
    multiplier,
    settled: true,
    gameKey: null,
    blocked: false
  })
}
