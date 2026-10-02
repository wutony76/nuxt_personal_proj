#!/usr/bin/env node
/**
 * 紙牌純函式測試。不登入、不打 HTTP。
 */
import { playLuckyDraw, ToyPlayError } from '../server/services/game/toys/luckyDraw.ts'
import { cardMultiplier, drawRank, freshDeck, judgeCard, playCards } from '../server/services/game/toys/cards.ts'
import { resetToyPool, writePool } from '../server/services/game/toys/pool.ts'

let failed = 0

function ok(name, pass, detail = '') {
  if (pass) {
    console.log(`ok ${name}`)
    return
  }
  failed += 1
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
}

function wallet(start) {
  let balance = start
  return {
    get balance() { return balance },
    debit: (_userId, amount) => {
      if (balance < amount) throw new Error('餘額不足')
      balance -= amount
      return balance
    },
    credit: (_userId, amount) => {
      balance += amount
      return balance
    }
  }
}

/** @param {number[]} ranks */
function scripted(ranks) {
  let deck = freshDeck()
  const queue = ranks.slice()
  return () => {
    if (deck.length === 0) deck = freshDeck()
    const rank = queue.shift()
    const index = deck.indexOf(rank)
    if (index < 0) throw new Error(`牌組沒有 ${rank}`)
    deck.splice(index, 1)
    return (index + 0.25) / (deck.length + 1)
  }
}

function play(userId, action, bet, choice, bag, rng) {
  return playCards({
    userId,
    action,
    bet,
    choice,
    balance: bag.balance,
    rng,
    wallet: bag
  })
}

/**
 * ⚠️ cards.ts 的 _guess() 會在真正抽牌「之前」多呼叫一次 rng() 決定這次猜測的目標輸贏
 * （難度機制，見 difficulty.ts），接著才用 scripted() 共用的那份牌堆 rng 抽牌——如果直接
 * 把 scripted() 傳給 playCards()，第一次呼叫會被「燒掉」當目標值，後面的牌全部跟著錯位、
 * 甚至會把 queue 提前抽乾炸掉。這裡包一層：只在「這次 guess 呼叫」的第一次呼叫回傳跟
 * 「預期猜中與否」一致的目標值（< 0.9 代表目標是贏、>= 0.9 代表目標是輸——跟寫這個情境
 * 的人一樣，必須先知道這次猜測應該贏還輸，才不會讓 resolveWithFate 重骰、多吃一張牌），
 * 之後每次呼叫才轉呼叫真正的 scripted() 牌堆 rng，牌堆序列才能照腳本預期前進。
 * 只有 'guess' 動作才會燒這個值，'start' 動作不會，呼叫端不要幫 start 包這層。
 * @param baseRng scripted() 建立的共用牌堆 rng
 * @param winTarget 這次猜測「預期」是贏還是輸
 */
function guessRng(baseRng, winTarget) {
  let first = true
  return () => {
    if (first) {
      first = false
      return winTarget ? 0 : 0.95
    }
    return baseRng()
  }
}

resetToyPool()
ok('點數範圍 1–13', freshDeck().length === 13 && Math.min(...freshDeck()) === 1 && Math.max(...freshDeck()) === 13)
ok('發完重洗', drawRank([], () => 0).deck.length === 12)
// 連勝表 CARD_STREAK（難度校準後）= [1, 1, 1.05, 1.1, 1.3]，索引 = 猜測前的連勝次數
ok('連勝表', cardMultiplier(0, 'high') === 1 && cardMultiplier(2, 'low') === 1.05 && cardMultiplier(4, 'high') === 1.3)
ok('相同固定 6.5', cardMultiplier(2, 'same') === 6.5)
ok('猜中判斷', judgeCard(7, 9, 'high') && !judgeCard(7, 3, 'high') && judgeCard(7, 7, 'same'))

resetToyPool()
const low = wallet(30)
let threw = false
try {
  play('low', 'start', 50, undefined, low, scripted([7]))
} catch (error) {
  threw = error instanceof ToyPlayError
}
ok('超額注額不扣款', low.balance === 30 && threw)

resetToyPool()
const bag = wallet(1000)
const high = scripted([7, 9, 11, 13])
const dealt = play('u1', 'start', 100, undefined, bag, high)
ok('開局先抽 7', dealt.rank === 7 && dealt.nextRank == null)
ok('開局扣一次', bag.balance === 900 && dealt.unclaimed === 0 && dealt.reward === 0)

const first = play('u1', 'guess', undefined, 'high', bag, guessRng(high, true))
ok('第一勝依連勝表 streak0=1（尚未成長）', first.correct && first.multiplier === 1 && first.nextRank === 9 && first.unclaimed === 100 && first.streak === 1)
ok('第一勝不再扣款', bag.balance === 900 && first.reward === 0)

const second = play('u1', 'guess', undefined, 'high', bag, guessRng(high, true))
ok('第二勝依連勝表 streak1=1（尚未成長）', second.correct && second.multiplier === 1 && second.nextRank === 11 && second.unclaimed === 100 && second.streak === 2)
ok('第二勝不再扣款', bag.balance === 900 && second.reward === 0)

const third = play('u1', 'guess', undefined, 'high', bag, guessRng(high, true))
ok('第三勝依連勝表 streak2=1.05 開始成長', third.correct && third.multiplier === 1.05 && third.nextRank === 13 && third.unclaimed === 105 && third.streak === 3)

resetToyPool()
const bustBag = wallet(1000)
const bustRng = scripted([7, 9, 3])
play('bust', 'start', 100, undefined, bustBag, bustRng)
play('bust', 'guess', undefined, 'high', bustBag, guessRng(bustRng, true))
const busted = play('bust', 'guess', undefined, 'high', bustBag, guessRng(bustRng, false))
ok('猜錯歸零', busted.correct === false && busted.unclaimed === 0 && busted.nextRank === 3)
ok('猜錯不加帳', bustBag.balance === 900 && busted.reward === 0)

resetToyPool()
writePool({
  userId: 'same',
  unclaimed: 0,
  gameKey: 'cards',
  bet: 100,
  claimed: false,
  meta: { rank: 7, deck: [7], streak: 0 }
})
const sameBag = wallet(900)
const same = playCards({
  userId: 'same',
  action: 'guess',
  choice: 'same',
  balance: sameBag.balance,
  rng: () => 0,
  wallet: sameBag
})
ok('相同 ×6.5 並計入連勝', same.correct && same.multiplier === 6.5 && same.streak === 1 && same.unclaimed === 650 && sameBag.balance === 900)

resetToyPool()
const streakBag = wallet(1000)
const rng = scripted([1, 2, 3, 4, 5, 6])
play('win5', 'start', 100, undefined, streakBag, rng)
let last = null
for (let i = 0; i < 5; i += 1) {
  last = play('win5', 'guess', undefined, 'high', streakBag, guessRng(rng, true))
}
ok('第 5 勝後不能再猜（連勝表 1/1/1.05/1.1/1.3 累乘到 151）', last.streak === 5 && last.unclaimed === 151 && last.canGuess === false && last.canClaim === true)
let blocked = false
try {
  play('win5', 'guess', undefined, 'high', streakBag, guessRng(rng, true))
} catch (error) {
  blocked = error instanceof ToyPlayError
}
ok('第 6 次猜被拒', blocked && streakBag.balance === 900)

const claimed = play('win5', 'claim', undefined, undefined, streakBag, rng)
ok('領取後入帳', claimed.claimed && claimed.reward === last.unclaimed && streakBag.balance === 900 + last.unclaimed)
let doubleClaim = false
try {
  play('win5', 'claim', undefined, undefined, streakBag, rng)
} catch (error) {
  doubleClaim = error instanceof ToyPlayError
}
ok('重複領取不加帳', doubleClaim && streakBag.balance === 900 + last.unclaimed)

resetToyPool()
const hold = wallet(500)
play('hold', 'start', 10, undefined, hold, scripted([4]))
let secondStart = false
try {
  play('hold', 'start', 10, undefined, hold, scripted([5]))
} catch (error) {
  secondStart = error instanceof ToyPlayError
}
ok('離頁未入帳仍佔用', hold.balance === 490 && secondStart)

let occupied = false
try {
  playLuckyDraw({
    userId: 'hold',
    action: 'start',
    bet: 10,
    cellIndex: 0,
    balance: hold.balance,
    rng: () => 0,
    wallet: hold
  })
} catch (error) {
  occupied = error instanceof ToyPlayError
}
ok('未領 0 的紙牌局擋住抽抽樂', occupied && hold.balance === 490)

if (failed > 0) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('紙牌測試通過')
