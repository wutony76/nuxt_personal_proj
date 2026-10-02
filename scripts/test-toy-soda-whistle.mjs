#!/usr/bin/env node
/**
 * 汽水笛純函式測試。不登入、不打 HTTP。
 */
import { SODA_BUST_RATES, SODA_PRIZES } from '../server/services/game/toys/catalog.ts'
import { playLuckyDraw } from '../server/services/game/toys/luckyDraw.ts'
import { ToyPlayError } from '../server/services/game/toys/luckyDraw.ts'
import { resetToyPool } from '../server/services/game/toys/pool.ts'
import { isSodaBust, playSoda, sodaPrize } from '../server/services/game/toys/sodaWhistle.ts'

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

function play(userId, action, bet, bag, roll) {
  return playSoda({
    userId,
    action,
    bet,
    balance: bag.balance,
    rng: () => roll,
    wallet: bag
  })
}

// ⚠️ isSodaBust() 難度校準後改成 roll >= scaleWinProbability(1-rate, difficulty)，
// 跟舊版「roll < rate 才算爆」正好相反——現在是「roll 越高越容易爆」，門檻是
// 1-rate（難度=1 時完全還原），不要再沿用舊的「低 roll=爆、高 roll=安全」直覺。
resetToyPool()
ok('示意表六階（難度校準後的回饋率 ≈98% 版本）', SODA_PRIZES.join() === '100,104,112,127,159,227')
ok('爆率遞增', SODA_BUST_RATES.join() === '0.02,0.04,0.07,0.12,0.2,0.3')
ok('注額 50 第二階 52', sodaPrize(50, 1) === 52)
ok('落在爆掉區間（第 3 階門檻 1-0.12=0.88，roll 要 >= 才算爆）', isSodaBust(3, 0.89) && !isSodaBust(3, 0.87))

resetToyPool()
const low = wallet(20)
let threw = false
try {
  play('low', 'start', 50, low, 0.99)
} catch (error) {
  threw = error instanceof ToyPlayError
}
ok('超額注額不扣款', low.balance === 20 && threw)

resetToyPool()
const bag = wallet(1000)
const first = play('u1', 'start', 50, bag, 0)
ok('第一階 50 且扣一次', first.busted === false && first.unclaimed === 50 && first.reward === 0 && bag.balance === 950)
const second = play('u1', 'continue', 50, bag, 0)
ok('第二階 52 不再扣款', second.busted === false && second.step === 2 && second.unclaimed === 52 && bag.balance === 950)

resetToyPool()
const bustBag = wallet(1000)
play('bust', 'start', 100, bustBag, 0)
play('bust', 'continue', 100, bustBag, 0)
const held = play('bust', 'continue', 100, bustBag, 0)
ok('吹到第三階 112', held.unclaimed === 112 && held.step === 3)
const busted = play('bust', 'continue', 100, bustBag, 0.99)
ok('注入爆掉歸零', busted.busted === true && busted.unclaimed === 0 && busted.reward === 0 && bustBag.balance === 900)

resetToyPool()
const top = wallet(1000)
let last = play('top', 'start', 100, top, 0)
for (let i = 0; i < 5; i += 1) last = play('top', 'continue', 100, top, 0)
ok('第六階後只能領', last.step === 6 && last.unclaimed === 227 && last.canContinue === false && last.canClaim === true)
let blocked = false
try {
  play('top', 'continue', 100, top, 0)
} catch (error) {
  blocked = error instanceof ToyPlayError
}
ok('第七次被拒', blocked && top.balance === 900)
const claimed = play('top', 'claim', 100, top, 0)
ok('領取入帳 227', claimed.claimed && claimed.reward === 227 && top.balance === 1127)
let doubleClaim = false
try {
  play('top', 'claim', 100, top, 0)
} catch (error) {
  doubleClaim = error instanceof ToyPlayError
}
ok('重複領取不加帳', doubleClaim && top.balance === 1127)

resetToyPool()
const hold = wallet(400)
play('hold', 'start', 10, hold, 0)
ok('離頁不入帳', hold.balance === 390)
let occupied = false
try {
  playLuckyDraw({
    userId: 'hold',
    action: 'start',
    bet: 10,
    cellIndex: 0,
    balance: hold.balance,
    rng: () => 0.5,
    wallet: hold
  })
} catch (error) {
  occupied = error instanceof ToyPlayError
}
ok('未領汽水笛擋住其他玩具', occupied && hold.balance === 390)

if (failed > 0) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('汽水笛測試通過')
