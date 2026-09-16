#!/usr/bin/env node
/**
 * 橡皮糖純函式測試。不登入、不打 HTTP。
 */
import { GUMMY_COLORS } from '../server/services/game/toys/catalog.ts'
import { playGummy } from '../server/services/game/toys/gummy.ts'
import { ToyPlayError } from '../server/services/game/toys/luckyDraw.ts'
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

function play(userId, action, bet, guess, bag, roll) {
  return playGummy({
    userId,
    action,
    bet,
    guess,
    balance: bag.balance,
    rng: () => roll,
    wallet: bag
  })
}

resetToyPool()
ok('四色各 25%', GUMMY_COLORS.every((item) => item.weight === 2500) && GUMMY_COLORS.length === 4)

resetToyPool()
const bag = wallet(1000)
play('hit', 'start', 100, undefined, bag, 0)
const red = play('hit', 'guess', undefined, 'red', bag, 0)
ok('注入紅且猜中', red.color === 'red' && red.correct === true && red.history.join() === 'red')
ok('第一勝 1.8 不再扣', red.multiplier === 1.8 && red.unclaimed === 180 && bag.balance === 900)

const yellow = play('hit', 'guess', undefined, 'yellow', bag, 0.3)
ok('最近四顆是真的', yellow.color === 'yellow' && yellow.history.join() === 'red,yellow' && yellow.multiplier === 3)

resetToyPool()
writePool({
  userId: 'bust',
  unclaimed: 300,
  gameKey: 'gummy',
  bet: 100,
  claimed: false,
  meta: { streak: 1, history: ['red'] }
})
const bustBag = wallet(900)
const busted = play('bust', 'guess', undefined, 'red', bustBag, 0.9)
ok('猜錯歸零', busted.correct === false && busted.color === 'green' && busted.unclaimed === 0 && busted.reward === 0)
ok('猜錯不加帳', bustBag.balance === 900)
ok('猜錯那顆也算真實記錄', busted.history.join() === 'red,green')

resetToyPool()
const top = wallet(1000)
play('top', 'start', 100, undefined, top, 0)
let last = null
for (let i = 0; i < 5; i += 1) last = play('top', 'guess', undefined, 'red', top, 0)
ok('第 5 勝後不能再猜', last.streak === 5 && last.canGuess === false && last.canClaim === true && top.balance === 900)
let blocked = false
try {
  play('top', 'guess', undefined, 'red', top, 0)
} catch (error) {
  blocked = error instanceof ToyPlayError
}
ok('第 6 次被拒', blocked)

if (failed > 0) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('橡皮糖測試通過')
