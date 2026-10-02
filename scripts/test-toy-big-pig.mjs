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

/**
 * ⚠️ difficulty.ts 的 resolveFate() 會在真正骰出 4 顆骰子「之前」多呼叫一次 rng()
 * 來決定這局的目標輸贏，接著 resolveWithFate() 才開始骰骰子——如果直接把 4 個骰面值
 * 丟給 createSequenceRng()，第一顆骰的值會被 resolveFate 吃掉，後面全部跟著錯位。
 * 這裡固定在骰面序列前面插入一個「燒掉」用的機率值：< 0.9（BASE_WIN_P，難度=1 時
 * 的基準勝率）代表目標是贏、>= 0.9 代表目標是輸——塞進跟這組骰面「實際輸贏」一致
 * 的目標，resolveWithFate 第一次骰就會命中目標、不會重骰，後面 4 個骰面才會照預期
 * 對應到 player/npc 兩顆骰，不會因為重骰而消耗序列最後一個值重複出現。
 * @param fateTarget 'win'：這組骰面本身算贏（tie／gold／pair／win）；'lose'：算輸（tiny／lose）
 */
function play(userId, bet, bag, faces, fateTarget = 'win') {
  const fateBurn = fateTarget === 'win' ? 0 : 0.95
  return playBigPig({
    userId,
    bet,
    balance: bag.balance,
    rng: createSequenceRng([fateBurn, ...faces.map(face)]),
    wallet: bag
  })
}

resetToyPool()
ok('和局不套金豬', judgePig([6, 6], [6, 6]).kind === 'tie')
ok('小豬只在點數較低', judgePig([1, 1], [1, 1]).kind === 'tie' && judgePig([1, 1], [3, 2]).kind === 'tiny')

// ⚠️ 實際入帳用的是 bigPig.ts 的 CALIBRATED_MULTIPLIER（難度校準後：win=1／pair=1.3／
// gold=2.28／tie 固定退本金），不是 judgePig() 回傳的原始倍數（win=1.9／pair=2.5／gold=5，
// 那只是牌型判定的歷史欄位，沒有拿來算錢），下面幾個倍數/金額都要照校準後的表來算。
resetToyPool()
const shown = wallet(1000)
const view = play('shown', 100, shown, [4, 5, 3, 2])
ok('畫面停在抽出的骰', view.player?.join() === '4,5' && view.npc?.join() === '3,2' && view.kind === 'win')
ok('一般勝 ×1（難度校準後只求不虧本）', view.multiplier === 1 && view.reward === 100 && shown.balance === 1000 && readPool('shown') == null)

resetToyPool()
const tieBag = wallet(1000)
const tie = play('tie', 100, tieBag, [1, 1, 1, 1])
ok('和局退注不再發獎', tie.kind === 'tie' && tie.reward === 100 && tieBag.balance === 1000)

resetToyPool()
const gold = wallet(1000)
const golden = play('gold', 100, gold, [6, 6, 3, 2])
ok('金豬 ×2.28（難度校準後的倍數）', golden.kind === 'gold' && golden.reward === 228 && gold.balance === 1128)

resetToyPool()
const pairBag = wallet(1000)
const pair = play('pair', 80, pairBag, [4, 4, 1, 2])
ok('雙豬 ×1.3（難度校準後的倍數）', pair.kind === 'pair' && pair.reward === 104 && pairBag.balance === 1024)

resetToyPool()
const tinyBag = wallet(500)
const tiny = play('tiny', 50, tinyBag, [1, 1, 6, 6], 'lose')
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
