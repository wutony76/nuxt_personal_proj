#!/usr/bin/env node
/**
 * 哨子糖純函式測試。不登入、不打 HTTP。
 */
import { ToyPlayError } from '../server/services/game/toys/luckyDraw.ts'
import { resetToyPool, writePool } from '../server/services/game/toys/pool.ts'
import { judgeWhistle, playWhistle, resetWhistleHistory, snapshotWhistle } from '../server/services/game/toys/whistleCandy.ts'

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

function play(userId, bet, choice, bag, roll) {
  return playWhistle({
    userId,
    bet,
    choice,
    balance: bag.balance,
    rng: () => roll,
    wallet: bag
  })
}

resetToyPool()
resetWhistleHistory()
ok('相剋', judgeWhistle('short', 'long') === 'win' && judgeWhistle('long', 'mid') === 'win' && judgeWhistle('mid', 'short') === 'win')
ok('相同平手', judgeWhistle('mid', 'mid') === 'tie')

resetToyPool()
const bag = wallet(1000)
const win = play('u1', 100, 'short', bag, 0.8)
ok('短勝長入帳 190', win.npc === 'long' && win.outcome === 'win' && win.reward === 190 && bag.balance === 1090)
ok('歷史是這次抽出的長', win.history.join() === 'long' && snapshotWhistle('u1', bag.balance).history.join() === 'long')

const again = play('u1', 100, 'short', bag, 0.4)
ok('歷史追加中且不再另抽', again.npc === 'mid' && again.history.join() === 'long,mid')

resetToyPool()
const tieBag = wallet(400)
const tie = play('tie', 50, 'short', tieBag, 0)
ok('相同退注', tie.outcome === 'tie' && tie.reward === 50 && tieBag.balance === 400)

resetToyPool()
const loseBag = wallet(300)
const lose = play('lose', 40, 'short', loseBag, 0.4)
ok('敗不加帳', lose.outcome === 'lose' && lose.reward === 0 && loseBag.balance === 260)

resetToyPool()
const hist = wallet(9000)
for (let i = 0; i < 9; i += 1) play('hist', 10, 'short', hist, 0.8)
ok('只留最近 8 次', snapshotWhistle('hist', hist.balance).history.length === 8)

resetToyPool()
writePool({ userId: 'busy', unclaimed: 10, gameKey: 'cards', bet: 10, claimed: false })
const busy = wallet(100)
let blocked = false
try {
  play('busy', 10, 'mid', busy, 0.4)
} catch (error) {
  blocked = error instanceof ToyPlayError
}
ok('彩池未結束不能開', blocked && busy.balance === 100)

if (failed > 0) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('哨子糖測試通過')
