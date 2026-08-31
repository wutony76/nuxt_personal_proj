export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type CardColor = 'red' | 'black'

export type CardLocation =
  | { zone: 'tableau'; column: number }
  | { zone: 'foundation'; suit: Suit }
  | { zone: 'stock' }
  | { zone: 'waste' }

export type Card = {
  id: string
  suit: Suit
  rank: Rank
  color: CardColor
  faceUp: boolean
  location: CardLocation
}

/** tryMove 的落點：Foundation 一律用花色指定目標疊（見 design.md Decision 1，四疊 Foundation 從一開始就是固定花色順位） */
export type TargetLocation = { zone: 'tableau'; column: number } | { zone: 'foundation'; suit: Suit }

export type MoveResult = {
  moved: boolean
  scoreDelta: number
  flippedCardId?: string
  won?: boolean
}

export type SolitaireSnapshot = {
  tableau: Card[][]
  foundations: Record<Suit, Card[]>
  stock: Card[]
  waste: Card[]
  score: number
  moves: number
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const COLUMN_COUNT = 7

/** 計分常數，估算值，見 design.md Decision 5，上線後應依實測校準 */
const MOVE_SCORE = 5
const FLIP_SCORE = 10
const FOUNDATION_SCORE = 10
const WIN_BONUS = 200

const colorForSuit = (suit: Suit): CardColor => (suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black')

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank: rank as Rank,
        color: colorForSuit(suit),
        faceUp: false,
        location: { zone: 'stock' }
      })
    }
  }
  return deck
}

export function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

/**
 * Klondike 接龍規則核心：牌組資料、發牌／洗牌、規則驗證、移動／抽牌／自動翻牌／勝利判定。
 * 純邏輯、不依賴 Vue，比照 match3Engine.ts 先例抽成獨立檔案（見 add-solitaire-game design.md Decision 1）。
 * 牌的 location 只存「邏輯位置」（第幾欄／哪個花色 Foundation），不存像素座標，
 * 實際渲染座標由呼叫端（solitaire.vue）依 location 自行換算（見 Decision 2）。
 */
export default class SolitaireCoreEngine {
  private tableau: Card[][] = []
  private foundations: Record<Suit, Card[]> = { hearts: [], diamonds: [], clubs: [], spades: [] }
  private stock: Card[] = []
  private waste: Card[] = []
  private score = 0
  private moves = 0
  /** 防刷分：記錄本局曾經翻正面過的牌，Stock/Waste 循環重複翻同一張牌不再加分（見 Decision 5） */
  private everFlipped = new Set<string>()
  private wonBonusAwarded = false

  constructor() {
    this.reset()
  }

  reset() {
    this.score = 0
    this.moves = 0
    this.everFlipped = new Set()
    this.wonBonusAwarded = false
    this.foundations = { hearts: [], diamonds: [], clubs: [], spades: [] }
    this.tableau = Array.from({ length: COLUMN_COUNT }, () => [])

    const deck = shuffle(createDeck())
    let cursor = 0
    for (let col = 0; col < COLUMN_COUNT; col += 1) {
      for (let i = 0; i <= col; i += 1) {
        const card = deck[cursor]!
        cursor += 1
        const faceUp = i === col
        card.faceUp = faceUp
        card.location = { zone: 'tableau', column: col }
        this.tableau[col]!.push(card)
        if (faceUp) this.everFlipped.add(card.id)
      }
    }
    this.stock = deck.slice(cursor)
    this.waste = []
  }

  private locateCard(cardId: string): { array: Card[]; index: number } | null {
    for (const column of this.tableau) {
      const idx = column.findIndex((c) => c.id === cardId)
      if (idx !== -1) return { array: column, index: idx }
    }
    for (const suit of SUITS) {
      const stack = this.foundations[suit]
      const idx = stack.findIndex((c) => c.id === cardId)
      if (idx !== -1) return { array: stack, index: idx }
    }
    const wasteIdx = this.waste.findIndex((c) => c.id === cardId)
    if (wasteIdx !== -1) return { array: this.waste, index: wasteIdx }
    const stockIdx = this.stock.findIndex((c) => c.id === cardId)
    if (stockIdx !== -1) return { array: this.stock, index: stockIdx }
    return null
  }

  canStackOnTableau(moving: Card, target: Card): boolean {
    return moving.color !== target.color && moving.rank === target.rank - 1
  }

  isValidSequence(cards: Card[]): boolean {
    if (cards.length === 0) return false
    if (!cards.every((c) => c.faceUp)) return false
    for (let i = 1; i < cards.length; i += 1) {
      if (!this.canStackOnTableau(cards[i]!, cards[i - 1]!)) return false
    }
    return true
  }

  canPlaceOnFoundation(card: Card, foundationStack: Card[]): boolean {
    if (foundationStack.length === 0) return card.rank === 1
    const top = foundationStack[foundationStack.length - 1]!
    return card.suit === top.suit && card.rank === top.rank + 1
  }

  /** 供 UI 判斷是否可以開始拖曳／點擊選取：回傳從這張牌到所在堆疊末端的合法可搬動牌組，不合法回傳 null */
  getGrabbableSequence(cardId: string): Card[] | null {
    const found = this.locateCard(cardId)
    if (!found) return null
    const { array, index } = found
    const sequence = array.slice(index)
    if (!this.isValidSequence(sequence)) return null
    return sequence.map((c) => ({ ...c }))
  }

  private flipTopIfNeeded(column: number): { flippedCardId?: string; scoreDelta: number } {
    const col = this.tableau[column]!
    if (col.length === 0) return { scoreDelta: 0 }
    const top = col[col.length - 1]!
    if (top.faceUp) return { scoreDelta: 0 }
    top.faceUp = true
    if (this.everFlipped.has(top.id)) return { flippedCardId: top.id, scoreDelta: 0 }
    this.everFlipped.add(top.id)
    return { flippedCardId: top.id, scoreDelta: FLIP_SCORE }
  }

  private finalizeMove(sourceZone: CardLocation, baseScore: number): MoveResult {
    this.moves += 1
    let scoreDelta = baseScore
    let flippedCardId: string | undefined
    if (sourceZone.zone === 'tableau') {
      const flip = this.flipTopIfNeeded(sourceZone.column)
      scoreDelta += flip.scoreDelta
      flippedCardId = flip.flippedCardId
    }
    const won = this.checkWin()
    if (won && !this.wonBonusAwarded) {
      this.wonBonusAwarded = true
      scoreDelta += WIN_BONUS
    }
    this.score += scoreDelta
    return { moved: true, scoreDelta, flippedCardId, won }
  }

  /** 統一的移動入口：拖曳與點擊模式都呼叫這裡，不各自實作規則判斷（見 Decision 3） */
  tryMove(cardId: string, target: TargetLocation): MoveResult {
    const NO_MOVE: MoveResult = { moved: false, scoreDelta: 0 }
    const found = this.locateCard(cardId)
    if (!found) return NO_MOVE
    const { array, index } = found
    const anchor = array[index]!
    const sequence = array.slice(index)
    if (!this.isValidSequence(sequence)) return NO_MOVE
    const sourceZone = anchor.location

    if (target.zone === 'tableau') {
      if (sourceZone.zone === 'tableau' && sourceZone.column === target.column) return NO_MOVE
      const destCol = this.tableau[target.column]!
      if (destCol.length === 0) {
        if (anchor.rank !== 13) return NO_MOVE
      } else if (!this.canStackOnTableau(anchor, destCol[destCol.length - 1]!)) {
        return NO_MOVE
      }
      array.splice(index, sequence.length)
      sequence.forEach((c) => {
        c.location = { zone: 'tableau', column: target.column }
      })
      destCol.push(...sequence)
      return this.finalizeMove(sourceZone, MOVE_SCORE)
    }

    // target.zone === 'foundation'：一次只能移動單張牌
    if (sequence.length !== 1) return NO_MOVE
    if (anchor.suit !== target.suit) return NO_MOVE
    if (sourceZone.zone === 'foundation') return NO_MOVE
    const foundationStack = this.foundations[target.suit]
    if (!this.canPlaceOnFoundation(anchor, foundationStack)) return NO_MOVE
    array.splice(index, 1)
    anchor.location = { zone: 'foundation', suit: target.suit }
    foundationStack.push(anchor)
    return this.finalizeMove(sourceZone, FOUNDATION_SCORE)
  }

  /** 雙擊自動上疊：依這張牌自己的花色嘗試對應的 Foundation（見 Decision 3） */
  tryAutoMoveToFoundation(cardId: string): MoveResult {
    const found = this.locateCard(cardId)
    if (!found) return { moved: false, scoreDelta: 0 }
    const card = found.array[found.index]!
    return this.tryMove(cardId, { zone: 'foundation', suit: card.suit })
  }

  /** Draw 1：Stock 抽一張到 Waste，見 design.md（本專案無既有 Solitaire 規格，採用業界最常見預設） */
  drawFromStock(): { drewCardId?: string; scoreDelta: number } {
    if (this.stock.length === 0) return { scoreDelta: 0 }
    const card = this.stock.pop()!
    card.faceUp = true
    card.location = { zone: 'waste' }
    this.waste.push(card)
    this.moves += 1
    let scoreDelta = 0
    if (!this.everFlipped.has(card.id)) {
      this.everFlipped.add(card.id)
      scoreDelta = FLIP_SCORE
    }
    this.score += scoreDelta
    return { drewCardId: card.id, scoreDelta }
  }

  /** Stock 空了才能呼叫：Waste 依序反轉放回 Stock，讓下一輪抽牌重現相同順序，次數不限（見 Decision 5） */
  recycleWasteToStock(): boolean {
    if (this.stock.length > 0 || this.waste.length === 0) return false
    const reversed = [...this.waste].reverse()
    reversed.forEach((c) => {
      c.faceUp = false
      c.location = { zone: 'stock' }
    })
    this.stock = reversed
    this.waste = []
    this.moves += 1
    return true
  }

  checkWin(): boolean {
    return SUITS.every((suit) => this.foundations[suit].length === 13)
  }

  getSnapshot(): SolitaireSnapshot {
    return {
      tableau: this.tableau.map((col) => col.map((c) => ({ ...c }))),
      foundations: {
        hearts: this.foundations.hearts.map((c) => ({ ...c })),
        diamonds: this.foundations.diamonds.map((c) => ({ ...c })),
        clubs: this.foundations.clubs.map((c) => ({ ...c })),
        spades: this.foundations.spades.map((c) => ({ ...c }))
      },
      stock: this.stock.map((c) => ({ ...c })),
      waste: this.waste.map((c) => ({ ...c })),
      score: this.score,
      moves: this.moves
    }
  }
}
