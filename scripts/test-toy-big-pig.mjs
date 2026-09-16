#!/usr/bin/env node
/**
 * 大豬公純函式測試。不登入、不打 HTTP。
 */
import { judgePig, playBigPig } from '../server/services/game/toys/bigPig.ts'
import { ToyPlayError } from '../server/services/game/toys/luckyDraw.ts'
import { readPool, resetToyPool, writePool } from '../server/services/game/toys/pool.ts'
import { createSequenceRng } from '../server/services/game/toys/random.ts'

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

function face(value) {
  return (value - 1 + 0.25) / 6
}

function play(userId, bet, bag, faces) {
  return playBigPig({
    userId,
    bet,
    balance: bag.balance,
    rng: createSequenceRng(faces.map(face)),
    wallet: bag
  })
}

resetToyPool()
ok('和局不套金豬', judgePig([6, 6], [6, 6]).kind === 'tie')
ok('小豬只在點數較低', judgePig([1, 1], [1, 1]).kind === 'tie' && judgePig([1, 1], [3, 2]).kind === 'tiny')

resetToyPool()
const shown = wallet(1000)
const view = play('shown', 100, shown, [4, 5, 3, 2])
ok('畫面停在抽出的骰', view.player?.join() === '4,5' && view.npc?.join() === '3,2' && view.kind === 'win')
ok('一般勝 ×1.9', view.multiplier === 1.9 && view.reward === 190 && shown.balance === 1090 && readPool('shown') == null)

resetToyPool()
const tieBag = wallet(1000)
const tie = play('tie', 100, tieBag, [1, 1, 1, 1])
ok('和局退注不再發獎', tie.kind === 'tie' && tie.reward === 100 && tieBag.balance === 1000)

resetToyPool()
const gold = wallet(1000)
const golden = play('gold', 100, gold, [6, 6, 3, 2])
ok('金豬 ×5', golden.kind === 'gold' && golden.reward === 500 && gold.balance === 1400)

resetToyPool()
const pairBag = wallet(1000)
const pair = play('pair', 80, pairBag, [4, 4, 1, 2])
ok('雙豬 ×2.5', pair.kind === 'pair' && pair.reward === 200 && pairBag.balance === 1120)

resetToyPool()
const tinyBag = wallet(500)
const tiny = play('tiny', 50, tinyBag, [1, 1, 6, 6])
ok('小豬不退注', tiny.kind === 'tiny' && tiny.reward === 0 && tinyBag.balance === 450)

resetToyPool()
writePool({ userId: 'busy', unclaimed: 20, gameKey: 'gummy', bet: 10, claimed: false })
const busy = wallet(200)
let blocked = false
try {
  play('busy', 10, busy, [2, 2, 1, 1])
} catch (error) {
  blocked = error instanceof ToyPlayError
}
ok('彩池未結束不能開', blocked && busy.balance === 200)

if (failed > 0) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('大豬公測試通過')
