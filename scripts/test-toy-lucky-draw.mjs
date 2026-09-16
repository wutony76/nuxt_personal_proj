#!/usr/bin/env node
/**
 * 抽抽樂純函式測試。不登入、不打 HTTP。
 * 平手與連勝不適用，略過。
 */
import { luckyDrawWeightSum } from '../server/services/game/toys/catalog.ts'
import { playLuckyDraw, ToyPlayError } from '../server/services/game/toys/luckyDraw.ts'
import { resetToyPool } from '../server/services/game/toys/pool.ts'

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

function play(userId, action, bet, cellIndex, bag, rngValue) {
  return playLuckyDraw({
    userId,
    action,
    bet,
    cellIndex,
    balance: bag.balance,
    rng: () => rngValue,
    wallet: bag
  })
}

resetToyPool()
ok('權重和 10000', luckyDrawWeightSum() === 10000, String(luckyDrawWeightSum()))
ok('平手不適用', true, 'skip')
ok('連勝不適用', true, 'skip')

const low = wallet(30)
let threw = false
try {
  play('low', 'start', 50, 0, low, 0)
} catch (error) {
  threw = error instanceof ToyPlayError
  ok('超額注額不扣款', low.balance === 30 && threw)
}
ok('注額 0 被拒', (() => {
  try {
    play('zero', 'start', 0, 0, wallet(100), 0)
    return false
  } catch {
    return true
  }
})())

resetToyPool()
const bag = wallet(1000)
const small = play('u1', 'start', 100, 3, bag, 0.5)
ok('小獎倍率 1.2', small.result?.rewardId === 'small' && small.result.multiplier === 1.2)
ok('選格只決定翻面', small.result?.cellIndex === 3)
ok('扣款一次', bag.balance === 900)
ok('未領金額 120', small.unclaimed === 120 && small.reward === 0)

const grown = play('u1', 'continue', 100, 1, bag, 0.8)
ok('繼續不扣款', bag.balance === 900)
ok('連乘為 240', grown.unclaimed === 240)

const bust = play('u1', 'continue', 100, 2, bag, 0)
ok('抽空歸零', bust.unclaimed === 0)
ok('抽空不加帳', bag.balance === 900)

resetToyPool()
const claimBag = wallet(500)
play('u2', 'start', 100, 0, claimBag, 0.5)
const claimed = play('u2', 'claim', 100, 0, claimBag, 0)
ok('領取入帳 120', claimed.reward === 120 && claimBag.balance === 520)
let secondClaimBlocked = false
try {
  play('u2', 'claim', 100, 0, claimBag, 0)
} catch {
  secondClaimBlocked = true
}
ok('重複領取不加帳', secondClaimBlocked && claimBag.balance === 520)

resetToyPool()
const superBag = wallet(100)
const jackpot = play('u3', 'start', 10, 7, superBag, 0.999)
ok('注入 RNG 命中超級獎', jackpot.result?.rewardId === 'super')
ok('離開頁面不自動入帳', superBag.balance === 90 && jackpot.unclaimed === 500)

resetToyPool()
const capBag = wallet(100)
play('u4', 'start', 1, 0, capBag, 0.999)
const capped = play('u4', 'continue', 1, 1, capBag, 0.999)
let cappedBlocked = false
try {
  play('u4', 'continue', 1, 2, capBag, 0.999)
} catch {
  cappedBlocked = true
}
ok('彩池上限 500 倍', capped.unclaimed === 500 && capped.canContinue === false && cappedBlocked)

if (failed > 0) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('抽抽樂測試通過')
