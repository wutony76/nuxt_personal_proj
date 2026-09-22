/**
 * NPC 自動遊玩：柑仔店櫥仔（toys）8 款玩法的隨機遊玩邏輯。
 *
 * 策略：
 * - 單回合玩法（大豬公、哨子糖）：直接一次呼叫完成
 * - 多回合 start+claim 玩法（抽抽樂、橡皮糖、汽水笛、紙牌、竹蜻蜓）：start 後立即 claim
 * - 多回合 play-to-end 玩法（尪仔標）：start 後連續出牌直到 settled
 * - 橡皮糖 / 紙牌：start 後先猜一次再 claim（start 後 canClaim: false 需要至少一次猜才能領）
 *
 * 任何一步拋錯都直接吞掉，不影響其他 NPC（同 _playRandomBg 的做法）。
 */

import { Storage } from 'serv/services/storage'
import { walletBalanceService } from 'serv/services/walletBalance'
import { TOY_BET_CHIPS, TOY_CATALOG, GUMMY_COLORS, BAMBOO_TARGETS } from 'serv/services/game/toys/catalog'
import { playBigPig } from 'serv/services/game/toys/bigPig'
import { playLuckyDraw } from 'serv/services/game/toys/luckyDraw'
import { playGummy, type GummyColor } from 'serv/services/game/toys/gummy'
import { playWhistle, WHISTLE_CHOICES } from 'serv/services/game/toys/whistleCandy'
import { playPog } from 'serv/services/game/toys/pog'
import { playBamboo, type BambooTargetId } from 'serv/services/game/toys/bambooCopter'
import { playSoda } from 'serv/services/game/toys/sodaWhistle'
import { playCards, type CardChoice } from 'serv/services/game/toys/cards'
import { ToyWalletPort } from 'serv/services/game/toys/luckyDraw'

const CARD_CHOICES: CardChoice[] = ['high', 'low', 'same']
const BAMBOO_TARGET_IDS = BAMBOO_TARGETS.map((t) => t.id) as BambooTargetId[]

/**
 * 建立玩具遊戲用的 wallet port，同各遊戲 API handler 的實作。
 * @param odds 當前賠率（來自 adminToyShopService.oddsOf）
 * @returns 符合 ToyWalletPort 介面的物件
 */
function _makeWallet(odds: number): ToyWalletPort {
  return {
    debit: (userId, amount, note) =>
      walletBalanceService.appendChange(userId, { type: 'toy-bet', amount: -amount, note }),
    credit: (userId, amount, note) =>
      walletBalanceService.appendChange(userId, {
        type: 'toy-reward',
        amount: Math.round(amount * odds * 100) / 100,
        note
      })
  }
}

/**
 * 從 allowedKeys 中隨機挑一款目前開放的柑仔店玩法並遊玩一局。
 * @param userId NPC 會員 id
 * @param allowedKeys 該 NPC 勾選允許的柑仔店遊戲 key（slug）陣列
 * @returns 本次扣款金額（用於日花費追蹤），無法遊玩時回 null
 */
export function playRandomToy(userId: string, allowedKeys: string[]): number | null {
  if (allowedKeys.length === 0) return null

  const toyShop = Storage.manager.lotteryTw.toyShop
  if (!toyShop.isEnabled()) return null

  // 只保留目前 catalog 上 status=open 且後台開關開啟的玩法
  const openKeys = allowedKeys.filter((k) => {
    const item = TOY_CATALOG.find((t) => t.slug === k)
    return item && item.status === 'open' && toyShop.isGameEnabled(k)
  })
  if (openKeys.length === 0) return null

  const slug = openKeys[Math.floor(Math.random() * openKeys.length)]!
  const betAmount = TOY_BET_CHIPS[Math.floor(Math.random() * TOY_BET_CHIPS.length)]!

  const user = Storage.get.user(userId) as { coin?: number } | null
  const balance = Number(user?.coin ?? 0)
  if (balance < betAmount) return null

  const wallet = _makeWallet(toyShop.oddsOf(slug))
  const difficulty = toyShop.difficultyOf(slug)

  try {
    switch (slug) {
      // ── 單回合 ────────────────────────────────────────────────────────
      case 'big-pig': {
        playBigPig({ userId, bet: betAmount, balance, rng: Math.random, wallet, difficulty })
        return betAmount
      }

      case 'whistle-candy': {
        const choice = WHISTLE_CHOICES[Math.floor(Math.random() * WHISTLE_CHOICES.length)]!
        playWhistle({ userId, bet: betAmount, choice, balance, rng: Math.random, wallet, difficulty })
        return betAmount
      }

      case 'bamboo-copter': {
        // 竹蜻蜓：start+claim 但以 target 作為單次投注，故視同單回合
        const target = BAMBOO_TARGET_IDS[Math.floor(Math.random() * BAMBOO_TARGET_IDS.length)]!
        playBamboo({ userId, bet: betAmount, target, balance, rng: Math.random, wallet, difficulty })
        return betAmount
      }

      // ── start 後可直接 claim ──────────────────────────────────────────
      case 'lucky-draw': {
        const cellIndex = Math.floor(Math.random() * 12) // LUCKY_DRAW_CELLS = 12
        const r = playLuckyDraw({ userId, action: 'start', bet: betAmount, cellIndex, balance, rng: Math.random, wallet, difficulty })
        if (r.canClaim) {
          playLuckyDraw({ userId, action: 'claim', bet: 0, cellIndex: 0, balance: 0, rng: Math.random, wallet, difficulty })
        }
        return betAmount
      }

      case 'soda-whistle': {
        const r = playSoda({ userId, action: 'start', bet: betAmount, balance, rng: Math.random, wallet, difficulty })
        if (r.canClaim) {
          playSoda({ userId, action: 'claim', bet: 0, balance: 0, rng: Math.random, wallet, difficulty })
        }
        return betAmount
      }

      // ── start 後需猜一次再 claim ──────────────────────────────────────
      case 'gummy': {
        const r1 = playGummy({ userId, action: 'start', bet: betAmount, balance, rng: Math.random, wallet, difficulty })
        if (r1.canGuess) {
          const guess = (GUMMY_COLORS as readonly { id: GummyColor }[])[
            Math.floor(Math.random() * GUMMY_COLORS.length)
          ]!.id
          const r2 = playGummy({ userId, action: 'guess', bet: 0, guess, balance: 0, rng: Math.random, wallet, difficulty })
          if (r2.canClaim) {
            playGummy({ userId, action: 'claim', bet: 0, balance: 0, rng: Math.random, wallet, difficulty })
          }
        }
        return betAmount
      }

      case 'cards': {
        const r1 = playCards({ userId, action: 'start', bet: betAmount, balance, rng: Math.random, wallet, difficulty })
        if (r1.canGuess) {
          const choice = CARD_CHOICES[Math.floor(Math.random() * CARD_CHOICES.length)]!
          const r2 = playCards({ userId, action: 'guess', choice, bet: 0, balance: 0, rng: Math.random, wallet, difficulty })
          if (r2.canClaim) {
            playCards({ userId, action: 'claim', bet: 0, balance: 0, rng: Math.random, wallet, difficulty })
          }
        }
        return betAmount
      }

      // ── 多回合打完（尪仔標）──────────────────────────────────────────
      case 'pog': {
        let view = playPog({ userId, action: 'start', bet: betAmount, balance, rng: Math.random, wallet, difficulty })
        let safety = 0
        while (view.canPlay && safety < 20) {
          const cardId = view.hand[0]?.id ?? ''
          if (!cardId) break
          view = playPog({ userId, action: 'play', bet: 0, cardId, balance: 0, rng: Math.random, wallet, difficulty })
          safety++
        }
        return betAmount
      }

      default:
        return null
    }
  } catch {
    return null
  }
}
