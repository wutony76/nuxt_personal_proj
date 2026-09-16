#!/usr/bin/env node
/**
 * 尪仔標純函式測試。不登入、不打 HTTP。
 */
import { ToyPlayError } from '../server/services/game/toys/luckyDraw.ts'
import { dealPog, freshPogDeck, playPog } from '../server/services/game/toys/pog.ts'
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

function card(id, rank, kind) {
  return { id, rank, kind }
}

function deck(ids) {
  const byId = Object.fromEntries(freshPogDeck().map((item) => [item.id, item]))
  return ids.map((id) => byId[id])
}

function play(userId, action, bet, cardId, bag, rolls, cards) {
  return playPog({
    userId,
    action,
    bet,
    cardId,
    deck: cards,
    balance: bag.balance,
    rng: createSequenceRng(rolls),
    wallet: bag
  })
}

resetToyPool()
const injected = deck(['8', '7', '6', '5', '4', '1', '2', '3', 'shield', 'bomb', 'king', 'swap'])
ok('前 10 張就是雙方手牌', dealPog(injected).player.map((item) => item.id).join() === '8,7,6,5,4'
  && dealPog(injected).npc.map((item) => item.id).join() === '1,2,3,shield,bomb')

resetToyPool()
const bag = wallet(1000)
const started = play('win', 'start', 100, undefined, bag, [0], injected)
ok('開局不重發', started.hand.map((item) => item.id).join() === '8,7,6,5,4' && bag.balance === 900)
let last = started
for (const id of ['8', '7', '6', '5', '4']) {
  last = play('win', 'play', undefined, id, bag, [0], injected)
}
ok('贏的回合多入帳 190 一次', last.settled && last.playerWins === 5 && last.reward === 190 && last.multiplier === 1.9 && bag.balance === 1090)
ok('打完不留彩池', readPool('win') == null)

resetToyPool()
const shieldDeck = deck(['shield', '8', '7', '6', '5', '4', '1', '2', '3', 'bomb', 'king', 'swap'])
const shieldBag = wallet(500)
play('shield', 'start', 40, undefined, shieldBag, [0], shieldDeck)
const shielded = play('shield', 'play', undefined, 'shield', shieldBag, [0], shieldDeck)
ok('盾抵掉一次失敗', shielded.last?.result === 'cancel' && shielded.npcWins === 0 && shielded.playerWins === 0 && shieldBag.balance === 460)

resetToyPool()
const swapDeck = deck(['swap', '8', '7', '6', '5', '1', '2', '3', '4', 'bomb', 'king', 'shield'])
const swapBag = wallet(400)
play('swap', 'start', 20, undefined, swapBag, [0], swapDeck)
const swapped = play('swap', 'play', undefined, 'swap', swapBag, [0, 0], swapDeck)
ok('換在出牌前重抽', swapped.last?.player.id === 'king' && swapped.last.npc.id === '1' && swapped.last.result === 'player')

resetToyPool()
const bombDeck = deck(['bomb', '3', '8', '7', '6', '2', '4', '1', '5', 'shield', 'king', 'swap'])
const bombBag = wallet(300)
play('bomb', 'start', 10, undefined, bombBag, [0], bombDeck)
play('bomb', 'play', undefined, 'bomb', bombBag, [0], bombDeck)
const bombed = play('bomb', 'play', undefined, '3', bombBag, [0], bombDeck)
ok('炸讓下一張 -2', bombed.last?.npc.id === '4' && bombed.last.npc.rank === 2 && bombed.last.result === 'player')

resetToyPool()
const kingDeck = deck(['king', '8', '7', '6', '5', '1', '2', '3', '4', 'bomb', 'shield', 'swap'])
const kingBag = wallet(1000)
play('king', 'start', 100, undefined, kingBag, [0], kingDeck)
let kingLast = null
for (const id of ['king', '8', '7', '6', '5']) kingLast = play('king', 'play', undefined, id, kingBag, [0], kingDeck)
ok('王取勝整局再乘 2', kingLast.reward === 380 && kingLast.multiplier === 3.8 && kingBag.balance === 1280)

resetToyPool()
writePool({ userId: 'busy', unclaimed: 30, gameKey: 'gummy', bet: 10, claimed: false })
const busy = wallet(100)
let blocked = false
try {
  play('busy', 'start', 10, undefined, busy, [0], injected)
} catch (error) {
  blocked = error instanceof ToyPlayError
}
ok('彩池未結束不能開', blocked && busy.balance === 100)

if (failed > 0) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('尪仔標測試通過')
