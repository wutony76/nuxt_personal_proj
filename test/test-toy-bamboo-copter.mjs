#!/usr/bin/env node
/**
 * 竹蜻蜓純函式測試。不登入、不打 HTTP。
 */
import { BAMBOO_BANDS, BAMBOO_TARGETS } from '../server/services/game/toys/catalog.ts'
import { drawBambooHeight, playBamboo } from '../server/services/game/toys/bambooCopter.ts'
import { ToyPlayError } from '../server/services/game/toys/luckyDraw.ts'
import { readPool, resetToyPool, writePool } from '../server/services/game/toys/pool.ts'

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

function play(userId, bet, target, bag, roll) {
  return playBamboo({
    userId,
    bet,
    target,
    balance: bag.balance,
    rng: () => roll,
    wallet: bag
  })
}

resetToyPool()
ok('高度帶權重 10000', BAMBOO_BANDS.reduce((sum, band) => sum + band.weight, 0) === 10000)
ok('五個目標', BAMBOO_TARGETS.map((item) => item.multiplier).join() === '1.1,1.4,2,4,15')
ok('注入 37m', drawBambooHeight(() => 0.725) === 37)
ok('低空帶', drawBambooHeight(() => 0) === 0 && drawBambooHeight(() => 0.0999) === 9)
ok('50m 以上', drawBambooHeight(() => 0.95) >= 50)

resetToyPool()
const low = wallet(20)
let threw = false
try {
  play('low', 50, 'm30', low, 0.725)
} catch (error) {
  threw = error instanceof ToyPlayError
}
ok('超額注額不扣款', low.balance === 20 && threw)

// m30 倍數難度校準後是 1.15（CALIBRATED_TARGET_MULTIPLIER，見 bambooCopter.ts），
// 不是 BAMBOO_TARGETS 原本內建的 2——難度=1 時達標與否完全交給 resolveFate 決定，
// 這張校準表才是真正拿來算錢的
resetToyPool()
const hitBag = wallet(1000)
const hit = play('hit', 100, 'm30', hitBag, 0.725)
ok('37m 判定達標', hit.height === 37 && hit.hit === true && hit.multiplier === 1.15)
ok('同一請求入帳且不留彩池', hit.reward === 115 && hitBag.balance === 1015 && readPool('hit') == null)

resetToyPool()
const missBag = wallet(1000)
const miss = play('miss', 100, 'm50', missBag, 0.725)
ok('未達標不加帳', miss.height === 37 && miss.hit === false && miss.reward === 0 && missBag.balance === 900)

resetToyPool()
writePool({ userId: 'busy', unclaimed: 80, gameKey: 'soda-whistle', bet: 50, claimed: false })
const busy = wallet(500)
let blocked = false
try {
  play('busy', 10, 'm10', busy, 0.725)
} catch (error) {
  blocked = error instanceof ToyPlayError
}
ok('彩池未結束不能開', blocked && busy.balance === 500)

if (failed > 0) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('竹蜻蜓測試通過')
