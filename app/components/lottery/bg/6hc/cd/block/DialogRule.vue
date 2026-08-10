<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  banboNumsOf,
  creditHexiaoOddsOf,
  creditLianweiOddsOf,
  creditLianxiaoOddsOf,
  creditWuxingOddsOf,
  ganzhiOfYear,
  shengxiaoNumsOf,
  shengxiaoOfYear,
  weishuAll,
  wuxingNumsOf,
  SX,
  CREDIT_JACKPOT,
  CREDIT_QIMA_BALL_COUNT,
  CREDIT_QIMA_ODDS,
  CREDIT_TEMA_ODDS,
  CREDIT_TIE_SPECIAL_NUMBER,
  CREDIT_ZHENGMA_NORMAL_COUNT,
  CREDIT_ZHENGMA_ODDS,
  CREDIT_ZHENGMA_SUM_LINE,
  CREDIT_ZHENGMATE_ODDS,
  type CreditMatchMode
} from '#shared/config/6hc-cd'
import C_PLAYS from '#shared/config/cd/plays'
import {
  creditComboCount,
  creditComboOf,
  creditMatchModeOf,
  creditQuotaOf,
  creditRtpOf,
  creditTabOddsOf,
  creditTiersOf
} from '#shared/config/cd/helpers'
import { actions } from '~/utils/common'
import { use6hcCredit } from '~/composables/use6hcCredit'

const SAMPLE_COIN = 10 // 派彩範例的注金

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { jackpot: mxJackpot, livePool: mxLivePool } = use6hcCredit()

const dialogEl = ref<HTMLElement | null>(null)

const NAV_ITEMS = [
  { id: 'cd-section-intro', label: '遊戲簡介' },
  { id: 'cd-section-timeline', label: '時間流程' },
  { id: 'cd-section-play', label: '投注玩法' },
  { id: 'cd-section-prize', label: '獎金結構' },
  { id: 'cd-section-jackpot', label: '獎池滾存' },
  { id: 'cd-section-note', label: '特別說明' },
]

// 每期 7 分鐘（server lotteryBase timer.getStatusBySeconds）
const TIMELINE = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒 — 5 分 50 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒 — 6 分 00 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒 — 6 分 40 秒', status: '正在開獎中', desc: '依序攪出 7 顆號碼（6 正碼＋特別號）' },
  { range: '6 分 40 秒 後', status: '已開獎', desc: '逐注結算派彩，可查閱結果' },
]

// 可投注玩法（與 shared/config 的賠率表、伺端結算邏輯同一份來源）
const PLAY_TYPES = [
  {
    key: 'number',
    name: '特碼單號',
    odds: CREDIT_TEMA_ODDS.number,
    rule: '所選號碼 = 特別號',
    desc: '從 01 — 49 選號，開出的特別號與所選號碼相同即中獎。',
    example: '例：選 07，特別號開 07 → 中獎',
  },
  {
    key: 'side',
    name: '特碼兩面',
    odds: CREDIT_TEMA_ODDS.side,
    rule: '特大／特小、特單／特雙、合單／合雙、尾大／尾小',
    desc: '特大 ≥ 25、特小 ≤ 24；單雙看奇偶；合數為十位＋個位；尾大 ≥ 5、尾小 ≤ 4。',
    example: `例：特別號 31 → 特大、特單、合雙（3+1=4）、尾小（尾 1）皆中`,
  },
  {
    key: 'color',
    name: '特碼色波',
    odds: `${CREDIT_TEMA_ODDS.colorRed} / ${CREDIT_TEMA_ODDS.colorBlue} / ${CREDIT_TEMA_ODDS.colorGreen}`,
    rule: '紅波 / 藍波 / 綠波',
    desc: '依特別號所屬色波判定（紅波 17 個號、藍波與綠波各 16 個號）。',
    example: '例：特別號 31 屬藍波 → 投注藍波中獎',
  },
]

// 正碼玩法（判定看 6 顆正碼與七球總和，與特碼的「只看特別號」不同）
const ZHENGMA_PLAY_TYPES = [
  {
    key: 'zhengma-number',
    name: '正碼單號',
    odds: CREDIT_ZHENGMA_ODDS.number,
    rule: `所選號碼命中 ${CREDIT_ZHENGMA_NORMAL_COUNT} 顆正碼之一`,
    desc: `從 01 — 49 選號，開出的前 ${CREDIT_ZHENGMA_NORMAL_COUNT} 顆正碼中出現所選號碼即中獎，特別號不算。`,
    example: '例：選 07，正碼開 07 → 中獎；只有特別號開 07 → 未中',
  },
  {
    key: 'zhengma-side',
    name: '總和兩面',
    odds: CREDIT_ZHENGMA_ODDS.side,
    rule: '總和大／總和小、總和單／總和雙',
    desc: `以 7 顆號碼（6 正碼＋特別號）相加的總和判定：≥ ${CREDIT_ZHENGMA_SUM_LINE} 為大、≤ ${CREDIT_ZHENGMA_SUM_LINE - 1} 為小；單雙看總和奇偶。`,
    example: '例：開 02,03,08,23,29,35＋30 → 總和 130 → 總和小、總和雙皆中',
  },
]

// 正碼特玩法（只看「指定名次那一顆正碼」，機率結構與特碼相同故賠率一致）
const ZHENGMATE_PLAY_TYPES = [
  {
    key: 'zhengmate-number',
    name: '正碼特單號',
    odds: CREDIT_ZHENGMATE_ODDS.number,
    rule: '所選號碼 = 該名次的正碼',
    desc: '在「正一特 — 正六特」分頁擇一，開出的該名次正碼與所選號碼相同即中獎，其他名次不算。',
    example: '例：在正三特選 07，第 3 顆正碼開 07 → 中獎；第 1 顆開 07 → 未中',
  },
  {
    key: 'zhengmate-side',
    name: '正碼特兩面',
    odds: CREDIT_ZHENGMATE_ODDS.side,
    rule: '大／小、單／雙、合單／合雙、尾大／尾小',
    desc: `判定方式與特碼兩面相同，但看的是該名次的正碼：大 ≥ 25、小 ≤ 24；合數為十位＋個位；尾大 ≥ 5、尾小 ≤ 4。`,
    example: '例：正二特開 31 → 大、單、合雙（3+1=4）、尾小 皆中',
  },
  {
    key: 'zhengmate-color',
    name: '正碼特色波',
    odds: `${CREDIT_ZHENGMATE_ODDS.colorRed} / ${CREDIT_ZHENGMATE_ODDS.colorBlue} / ${CREDIT_ZHENGMATE_ODDS.colorGreen}`,
    rule: '紅波 / 藍波 / 綠波',
    desc: '依該名次正碼所屬色波判定（紅波 17 個號、藍波與綠波各 16 個號）。',
    example: '例：正五特開 31 屬藍波 → 投注正五特藍波中獎',
  },
]

// 七碼玩法（看整期七顆球的組成比例，與任何單一顆球無關）
const QIMA_PLAY_TYPES = [
  {
    key: 'qima-oddeven',
    name: '七碼單雙',
    odds: `${Math.min(...Object.values(CREDIT_QIMA_ODDS))} — ${Math.max(...Object.values(CREDIT_QIMA_ODDS))}`,
    rule: '單0雙7 — 單7雙0（共 8 種組合）',
    desc: `統計 ${CREDIT_QIMA_BALL_COUNT} 顆球（${CREDIT_ZHENGMA_NORMAL_COUNT} 正碼＋特別號）中單號與雙號各幾顆，與所選組合完全相同才中獎。`,
    example: '例：開 03,08,15,22,29,36＋41 → 單 4 顆、雙 3 顆 → 投注「單4雙3」中獎',
  },
  {
    key: 'qima-bigsmall',
    name: '七碼大小',
    odds: `${Math.min(...Object.values(CREDIT_QIMA_ODDS))} — ${Math.max(...Object.values(CREDIT_QIMA_ODDS))}`,
    rule: '大0小7 — 大7小0（共 8 種組合）',
    desc: `統計 ${CREDIT_QIMA_BALL_COUNT} 顆球中大號（≥ 25）與小號（≤ 24）各幾顆，與所選組合完全相同才中獎。`,
    example: '例：開 03,08,15,22,29,36＋41 → 大 3 顆、小 4 顆 → 投注「大3小4」中獎',
  },
]

// 七碼各組合的命中機率（超幾何分布：49 選 7，單／大各 25 個號、雙／小各 24 個號）
// 兩組分布相同，故共用同一份機率與賠率
const QIMA_ODDS_ROWS = [
  { count: 0, rate: '0.4029%' },
  { count: 1, rate: '3.9172%' },
  { count: 2, rate: '14.8441%' },
  { count: 3, rate: '28.4513%' },
  { count: 4, rate: '29.8061%' },
  { count: 5, rate: '17.0708%' },
  { count: 6, rate: '4.9480%' },
  { count: 7, rate: '0.5596%' },
].map((item) => ({
  ...item,
  oddEven: `單${item.count}雙${CREDIT_QIMA_BALL_COUNT - item.count}`,
  bigSmall: `大${item.count}小${CREDIT_QIMA_BALL_COUNT - item.count}`,
  odds: Number(CREDIT_QIMA_ODDS[`單${item.count}雙${CREDIT_QIMA_BALL_COUNT - item.count}`] ?? 0),
}))

// 連碼玩法：一注帶多個號碼、依命中組成分檔派彩，賠率與選號規格直接讀 c_lianma 設定
const LIANMA_TABS = (C_PLAYS as Array<{ key?: string; list?: Array<Record<string, any>> }>)
  .find((play) => play.key === 'lianma')?.list ?? []
const LIANMA_RULES: Record<string, { rule: string; desc: string; example: string }> = {
  三全中: {
    rule: '3 個號全中正碼',
    desc: '選 3 個號，全部命中 6 顆正碼才算中獎；含特別號不算。',
    example: '例：正碼開 03 08 15 22 29 36 → 選 03、15、22 中獎',
  },
  三中二: {
    rule: '命中 3 個為中三、命中 2 個為中二',
    desc: '選 3 個號，依命中的正碼數分兩檔派彩。剩下那個號碼是特別號時，本盤併入中二計算。',
    example: '例：選 03、15、07 命中 2 個正碼 → 中二；選 03、15、22 → 中三',
  },
  二全中: {
    rule: '2 個號全中正碼',
    desc: '選 2 個號，兩個都要是正碼；1 個正碼 + 特別號不算中。',
    example: '例：選 03、15 皆為正碼 → 中獎；選 03、特別號 → 未中',
  },
  二中特: {
    rule: '2 個正碼為中二、1 正碼 + 特別號為中特',
    desc: '選 2 個號，兩種中法各有賠率；中特較稀有（0.51% vs 1.28%），賠率較高。',
    example: '例：選 03、15 → 中二；選 03、特別號 → 中特',
  },
  特串: {
    rule: '1 個正碼 + 1 個特別號',
    desc: '選 2 個號，必須剛好一個是正碼、一個是特別號；兩個都是正碼不算中。',
    example: '例：特別號開 41，選 03、41 → 中獎；選 03、15 → 未中',
  },
}
const LIANMA_PLAY_TYPES = LIANMA_TABS.map((tab) => {
  const name = String(tab.tabName ?? '')
  const combo = creditComboOf('lianma', tab.tabId)
  const tiers = creditTiersOf('lianma', tab.tabId)
  const rule = LIANMA_RULES[name]
  return {
    key: `lianma-${tab.tabId}`,
    name,
    odds: tiers.map((tier) => `${tier.name} ${tier.odds}`).join(' / '),
    rule: rule?.rule ?? '',
    desc: `${rule?.desc ?? ''}一注 ${combo?.pick ?? 0} 個號，最多可選 ${combo?.maxPick ?? 0} 個組複式（${creditComboCount(combo?.maxPick ?? 0, combo?.pick ?? 0)} 注）。`,
    example: rule?.example ?? '',
  }
})

// 五行：號碼與賠率都逐年輪轉（納音），直接讀當年的表，跨年自動跟上
const WUXING_YEAR = new Date().getFullYear()
const WUXING_ROWS = ['金', '木', '水', '火', '土'].map((name) => {
  const nums = wuxingNumsOf(name, WUXING_YEAR)
  return { name, nums, count: nums.length, odds: creditWuxingOddsOf(name, WUXING_YEAR, creditRtpOf('wuxing', 7000)) }
})

// 半波：色波 ∩ 大小／單雙，號碼由 banboNumsOf 算出（色波分布固定，不隨年變）
const BANBO_ROWS = ['紅', '綠', '藍'].flatMap((color) =>
  ['大', '小', '單', '雙'].map((side) => {
    const name = `${color}${side}`
    const nums = banboNumsOf(name)
    return { name, color, nums, count: nums.length, odds: creditTabOddsOf('banbo', 8000, name) }
  })
)

// 一肖：號碼與賠率都逐年輪轉（當年生肖多 49 這一個號），兩個分頁共用號碼但中獎方向相反
const YIXIAO_YEAR = new Date().getFullYear()
const YIXIAO_ANIMAL = shengxiaoOfYear(YIXIAO_YEAR)
const YIXIAO_ROWS = (SX as readonly string[]).map((name) => {
  const nums = shengxiaoNumsOf(name, YIXIAO_YEAR)
  return {
    name,
    nums,
    count: nums.length,
    hitOdds: creditTabOddsOf('yixiao', 10000, name, YIXIAO_YEAR),
    missOdds: creditTabOddsOf('yixiao', 10001, name, YIXIAO_YEAR),
  }
})

// 特肖：與一肖中同賠率公式與判定（只看特別號所屬生肖），只有一個分頁（無中/不中之分）
const TEXIAO_YEAR = new Date().getFullYear()
const TEXIAO_ROWS = (SX as readonly string[]).map((name) => {
  const nums = shengxiaoNumsOf(name, TEXIAO_YEAR)
  return { name, nums, count: nums.length, odds: creditTabOddsOf('texiao', 11000, name, TEXIAO_YEAR) }
})

// 合肖 / 連肖：注項由玩家自組（選 n 個生肖），賠率取決於是否含當年生肖 ——
// 以「全部不含當年生肖」與「恰含 1 個當年生肖」兩種極端組合算出實際區間，與 config 檔頭註解的算法一致
const _animalOddsRangeOf = (
  oddsFn: (animals: string[], year: number, mode: CreditMatchMode, rtp: number) => number,
  pick: number,
  year: number,
  mode: CreditMatchMode,
  rtp: number
): { min: number; max: number } | null => {
  if (!(pick > 0)) return null
  const yearAnimal = shengxiaoOfYear(year)
  const others = (SX as readonly string[]).filter((a) => a !== yearAnimal)
  const allCommon = others.slice(0, pick)
  const withYearAnimal = [yearAnimal, ...others.slice(0, pick - 1)]
  const values = [allCommon, withYearAnimal]
    .filter((list) => list.length === pick)
    .map((list) => oddsFn(list, year, mode, rtp))
    .filter((odds) => odds > 0)
  if (values.length === 0) return null
  return { min: Math.min(...values), max: Math.max(...values) }
}
const _formatOddsRange = (range: { min: number; max: number } | null): string => {
  if (!range) return '—'
  return range.min === range.max ? String(range.min) : `${range.min} — ${range.max}`
}

const HEXIAO_YEAR = new Date().getFullYear()
const HEXIAO_TABS = (C_PLAYS as Array<{ key?: string; list?: Array<Record<string, any>> }>)
  .find((play) => play.key === 'hexiao')?.list ?? []
const HEXIAO_PLAY_TYPES = HEXIAO_TABS.map((tab) => {
  const name = String(tab.tabName ?? '')
  const combo = creditComboOf('hexiao', tab.tabId)
  const mode = creditMatchModeOf('hexiao', tab.tabId)
  const range = _animalOddsRangeOf(creditHexiaoOddsOf, combo?.pick ?? 0, HEXIAO_YEAR, mode, creditRtpOf('hexiao', tab.tabId))
  return {
    key: `hexiao-${tab.tabId}`,
    name,
    odds: _formatOddsRange(range),
    rule: mode === 'miss'
      ? `特別號的生肖都不屬於所選 ${combo?.pick ?? 0} 個生肖才中`
      : `特別號的生肖屬於所選 ${combo?.pick ?? 0} 個生肖之一即中`,
    desc: `選 ${combo?.pick ?? 0} 個生肖，最多可選 ${combo?.maxPick ?? 0} 個組複式（${creditComboCount(combo?.maxPick ?? 0, combo?.pick ?? 0)} 注）。只看特別號一顆球，賠率依所選生肖是否含當年生肖變動。`,
    example: '',
  }
})

const LIANXIAO_YEAR = new Date().getFullYear()
const LIANXIAO_TABS = (C_PLAYS as Array<{ key?: string; list?: Array<Record<string, any>> }>)
  .find((play) => play.key === 'lianxiao')?.list ?? []
const LIANXIAO_PLAY_TYPES = LIANXIAO_TABS.map((tab) => {
  const name = String(tab.tabName ?? '')
  const combo = creditComboOf('lianxiao', tab.tabId)
  const mode = creditMatchModeOf('lianxiao', tab.tabId)
  const range = _animalOddsRangeOf(creditLianxiaoOddsOf, combo?.pick ?? 0, LIANXIAO_YEAR, mode, creditRtpOf('lianxiao', tab.tabId))
  return {
    key: `lianxiao-${tab.tabId}`,
    name,
    odds: _formatOddsRange(range),
    rule: mode === 'miss'
      ? `所選 ${combo?.pick ?? 0} 個生肖一個都沒出現在 7 顆球中才中`
      : `所選 ${combo?.pick ?? 0} 個生肖全部出現在 7 顆球中才中`,
    desc: `選 ${combo?.pick ?? 0} 個生肖，最多可選 ${combo?.maxPick ?? 0} 個組複式（${creditComboCount(combo?.maxPick ?? 0, combo?.pick ?? 0)} 注）。看整期 7 顆球，賠率依所選生肖是否含當年生肖變動。`,
    example: '',
  }
})

// 尾數：0 ~ 9 尾，號碼分布固定不隨年份輪轉（與一肖不同），兩個分頁共用同一份號碼但中獎方向相反
const WEISHU_TAILS = Array.from({ length: 10 }, (_, i) => `${i}尾`)
const WEISHU_ROWS = WEISHU_TAILS.map((name) => {
  const nums = weishuAll[name] ?? []
  return {
    name,
    nums,
    count: nums.length,
    hitOdds: creditTabOddsOf('weishu', 15000, name),
    missOdds: creditTabOddsOf('weishu', 15001, name),
  }
})

// 連尾：注項由玩家自組（選 n 個尾數），賠率取決於是否含「0 尾」（0 尾只有 4 個號，其餘各 5 個）——
// 以「含 0 尾」與「不含 0 尾」兩種極端組合算出實際區間，與 config 檔頭註解的算法一致
const _tailOddsRangeOf = (
  oddsFn: (tails: string[], mode: CreditMatchMode, rtp: number) => number,
  pick: number,
  mode: CreditMatchMode,
  rtp: number
): { min: number; max: number } | null => {
  if (!(pick > 0) || pick > WEISHU_TAILS.length) return null
  const withZero = WEISHU_TAILS.slice(0, pick)
  const withoutZero = WEISHU_TAILS.slice(1, pick + 1)
  const values = [withZero, withoutZero]
    .filter((list) => list.length === pick)
    .map((list) => oddsFn(list, mode, rtp))
    .filter((odds) => odds > 0)
  if (values.length === 0) return null
  return { min: Math.min(...values), max: Math.max(...values) }
}

const LIANWEI_TABS = (C_PLAYS as Array<{ key?: string; list?: Array<Record<string, any>> }>)
  .find((play) => play.key === 'lianwei')?.list ?? []
const LIANWEI_PLAY_TYPES = LIANWEI_TABS.map((tab) => {
  const name = String(tab.tabName ?? '')
  const combo = creditComboOf('lianwei', tab.tabId)
  const mode = creditMatchModeOf('lianwei', tab.tabId)
  const range = _tailOddsRangeOf(creditLianweiOddsOf, combo?.pick ?? 0, mode, creditRtpOf('lianwei', tab.tabId))
  return {
    key: `lianwei-${tab.tabId}`,
    name,
    odds: _formatOddsRange(range),
    rule: mode === 'miss'
      ? `所選 ${combo?.pick ?? 0} 個尾數一個都沒出現在 7 顆球中才中`
      : `所選 ${combo?.pick ?? 0} 個尾數全部出現在 7 顆球中才中`,
    desc: `選 ${combo?.pick ?? 0} 個尾數，最多可選 ${combo?.maxPick ?? 0} 個組複式（${creditComboCount(combo?.maxPick ?? 0, combo?.pick ?? 0)} 注）。看整期 7 顆球，賠率依所選尾數是否含 0 尾變動。`,
    example: '',
  }
})

const PRIZE_ROWS = [
  { name: '特碼單號', condition: '號碼 = 特別號', odds: CREDIT_TEMA_ODDS.number, hint: '49 選 1，理論值 49' },
  { name: '特碼兩面', condition: '大小／單雙／合單雙／尾大小', odds: CREDIT_TEMA_ODDS.side, hint: `開 ${CREDIT_TIE_SPECIAL_NUMBER} 號為和局，退還本金` },
  { name: '紅波', condition: '特別號屬紅波（17 個號）', odds: CREDIT_TEMA_ODDS.colorRed, hint: '理論值 2.88' },
  { name: '藍波', condition: '特別號屬藍波（16 個號）', odds: CREDIT_TEMA_ODDS.colorBlue, hint: '理論值 3.06' },
  { name: '綠波', condition: '特別號屬綠波（16 個號，含 49）', odds: CREDIT_TEMA_ODDS.colorGreen, hint: '理論值 3.06' },
  { name: '正碼單號', condition: `號碼命中 ${CREDIT_ZHENGMA_NORMAL_COUNT} 顆正碼之一`, odds: CREDIT_ZHENGMA_ODDS.number, hint: `49 選 ${CREDIT_ZHENGMA_NORMAL_COUNT}，理論值 8.17` },
  { name: '總和兩面', condition: `七球總和 大／小（界 ${CREDIT_ZHENGMA_SUM_LINE}）、單／雙`, odds: CREDIT_ZHENGMA_ODDS.side, hint: '不設和局' },
  { name: '正碼特單號', condition: '號碼 = 該名次的正碼', odds: CREDIT_ZHENGMATE_ODDS.number, hint: '49 選 1，理論值 49' },
  { name: '正碼特兩面', condition: '該名次正碼 大小／單雙／合單雙／尾大小', odds: CREDIT_ZHENGMATE_ODDS.side, hint: `該顆開 ${CREDIT_TIE_SPECIAL_NUMBER} 為和局，退還本金` },
  { name: '正碼特紅波', condition: '該名次正碼屬紅波（17 個號）', odds: CREDIT_ZHENGMATE_ODDS.colorRed, hint: '理論值 2.88' },
  { name: '正碼特藍波', condition: '該名次正碼屬藍波（16 個號）', odds: CREDIT_ZHENGMATE_ODDS.colorBlue, hint: '理論值 3.06' },
  { name: '正碼特綠波', condition: `該名次正碼屬綠波（16 個號，含 ${CREDIT_TIE_SPECIAL_NUMBER}）`, odds: CREDIT_ZHENGMATE_ODDS.colorGreen, hint: '理論值 3.06' },
  // 連碼各檔次：條件與賠率都讀 c_lianma 的 tiers，config 調整後自動跟上
  ...LIANMA_TABS.flatMap((tab) => {
    const tabName = String(tab.tabName ?? '')
    const hints: Record<string, string> = {
      all3: '理論值 921.20', hit3: '理論值 921.20', hit2: '', all2: '理論值 78.40',
      hitT: '理論值 196.00', chain: '理論值 196.00',
    }
    return creditTiersOf('lianma', tab.tabId).map((tier) => ({
      name: `${tabName}${tier.name === tabName ? '' : ` · ${tier.name}`}`,
      condition: LIANMA_RULES[tabName]?.rule ?? '',
      odds: Number(tier.odds),
      hint: hints[String(tier.key)] || (tabName === '三中二' ? '理論值 28.56' : '理論值 78.40'),
    }))
  }),
]

// 各分頁的賠率與限額：直接讀 c_tema / c_zhengma 設定，config 調整後說明頁自動跟上
const TAB_ROWS = (C_PLAYS as Array<{ name?: string; key?: string; list?: Array<Record<string, any>> }>)
  .flatMap((play) => (play.list ?? []).map((tab) => {
    const quota = creditQuotaOf(play.key, tab.tabId)
    // 連碼的賠率在命中檔次上（號碼池不帶 odds），其餘玩法取各群組第一個注項的賠率當代表
    const odds = (tab.tiers?.length
      ? tab.tiers.map((tier: any) => ({ groupName: String(tier?.name ?? ''), odds: Number(tier?.odds ?? 0) }))
      : (tab.tabGroup ?? []).map((group: any) => ({
        groupName: String(group?.groupName ?? ''),
        odds: Number(group?.groupList?.[0]?.odds ?? 0),
      }))
    ).filter((item: { odds: number }) => item.odds > 0)
    return {
      playName: String(play.name ?? play.key ?? ''),
      tabName: String(tab.tabName ?? ''),
      itemMin: quota.item.min,
      itemMax: quota.item.max,
      issueMax: quota.issue.max,
      odds,
    }
  }))

// --- COMPUTED ---
const totalPool = computed(() => mxLivePool.value)
const currentIssuePool = computed(() => Number(mxJackpot.currentIssueJackpot ?? 0))
const carryPool = computed(() => Number(mxJackpot.carryJackpot ?? 0))
// 可發放累積池（當期抽水 + 累積滾存，不含展示用池底）
const distributablePool = computed(() => Number(mxJackpot.distributable ?? 0))
const estimatedPayout = computed(() => Number((distributablePool.value * CREDIT_JACKPOT.payoutRatio).toFixed(2)))
const lastHit = computed(() => mxJackpot.lastHit)
// 爆池分配權重：直接讀各玩法看板設定的 tabGroup[].weight（七碼由 groupList[].weight 逐項覆寫），
// 與伺端 creditJackpotWeightOf 同一份來源，config 調整後說明頁自動跟上。
// 同一玩法內權重相同的群組併成一列，名稱超過兩個以「首 — 末」表示（正一特 — 正六特）。
const JACKPOT_WEIGHT_ROWS = (C_PLAYS as Array<{ name?: string; list?: Array<Record<string, any>> }>)
  .flatMap((play) => {
    const byWeight = new Map<string, Set<string>>()
    ;(play.list ?? []).forEach((tab) => (tab.tabGroup ?? []).forEach((group: any) => {
      // 連碼的權重掛在命中檔次上；其餘玩法看注項（七碼逐項覆寫）再看群組
      const itemWeights = [...new Set(
        (tab.tiers?.length ? tab.tiers : (group?.groupList ?? []))
          .map((item: any) => Number(item?.weight)).filter((w: number) => w > 0)
      )] as number[]
      const label = itemWeights.length > 0
        ? (itemWeights.length === 1
          ? String(itemWeights[0])
          : `${Math.min(...itemWeights)} — ${Math.max(...itemWeights)}`)
        : String(Number(group?.weight ?? 0) || '—')
      const names = byWeight.get(label) ?? new Set<string>()
      names.add(String(group?.groupName ?? ''))
      byWeight.set(label, names)
    }))
    return [...byWeight.entries()].map(([weight, nameSet]) => {
      const names = [...nameSet]
      return {
        playName: String(play.name ?? ''),
        groupName: names.length > 2 ? `${names[0]} — ${names[names.length - 1]}` : names.join('、'),
        weight,
      }
    })
  })

// --- HANDLE ---
const _handlers = {
  payoutOf: (odds: number) => Number((SAMPLE_COIN * odds).toFixed(2)),
  profitOf: (odds: number) => Number((SAMPLE_COIN * odds - SAMPLE_COIN).toFixed(2)),
}

const click = {
  scrollTo: (id: string) => {
    const container = dialogEl.value
    const target = container?.querySelector<HTMLElement>(`#${id}`)
    if (!container || !target) return
    container.scrollTo({ top: target.offsetTop - container.offsetTop - 8, behavior: 'smooth' })
  },
  backTop: () => {
    dialogEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
  },
}
</script>

<template>
  <div v-if="visible" class="cd-rule-mask" @click.self="emit('close')">
    <section ref="dialogEl" class="cd-rule-dialog">
      <header class="cd-rule-header">
        <h3>遊戲說明 — 六合彩信用玩法</h3>
        <button type="button" class="close-btn" @click="emit('close')">×</button>
      </header>

      <nav class="cd-rule-nav">
        <button v-for="item in NAV_ITEMS" :key="item.id" type="button" class="cd-rule-nav-btn"
          @click="click.scrollTo(item.id)">
          {{ item.label }}
        </button>
      </nav>

      <div class="cd-rule-body">
        <!-- 遊戲簡介 -->
        <div id="cd-section-intro" class="rule-section">
          <h4 class="rule-title">遊戲簡介</h4>
          <ul class="rule-list">
            <li>從 <strong>01 — 49</strong> 共 49 顆號碼中，每期隨機攪出 <strong>7 顆</strong>（6 正碼＋1 特別號）。</li>
            <li>每日共 <strong>205 期</strong>，每 <strong>7 分鐘</strong> 開獎一次。</li>
            <li>信用玩法為 <strong>每注獨立、按賠率派彩</strong>；結算依玩法而定 —
              <strong>特碼</strong>看第 7 顆特別號，<strong>正碼</strong>看前
              {{ CREDIT_ZHENGMA_NORMAL_COUNT }} 顆正碼與七球總和，
              <strong>正碼特</strong>看指定名次的那一顆正碼，
              <strong>連碼</strong>看自選號碼組命中幾個正碼／是否含特別號，
              <strong>七碼</strong>看 {{ CREDIT_QIMA_BALL_COUNT }} 顆球的單雙／大小組成顆數，
              <strong>五行</strong>、<strong>半波</strong>、<strong>一肖</strong>、<strong>特肖</strong>與<strong>尾數</strong>看特別號落在哪一組號碼，
              <strong>合肖</strong>看特別號所屬生肖是否屬於自選的那組生肖，
              <strong>連肖</strong>看自選生肖是否全部出現在 7 顆球中，
              <strong>連尾</strong>看自選尾數是否全部出現在 7 顆球中。
            </li>
            <li>與官方玩法的差異：官方是「一注 6 顆號碼、依命中數分層領獎池」，信用玩法是「一注一個注項、中獎即按賠率派彩」。</li>
          </ul>
        </div>

        <!-- 時間流程 -->
        <div id="cd-section-timeline" class="rule-section">
          <h4 class="rule-title">時間流程（每期共 7 分鐘）</h4>
          <div class="rule-table-wrap">
            <table class="rule-table">
              <colgroup>
                <col style="width: 34%" />
                <col style="width: 20%" />
                <col style="width: 46%" />
              </colgroup>
              <thead>
                <tr>
                  <th>時間節點</th>
                  <th>狀態</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in TIMELINE" :key="item.status">
                  <td class="td-range">{{ item.range }}</td>
                  <td><span class="status-badge" :class="`status-${item.status}`">{{ item.status }}</span></td>
                  <td>{{ item.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 投注玩法 -->
        <div id="cd-section-play" class="rule-section">
          <h4 class="rule-title">投注玩法</h4>
          <p class="rule-note">
            目前開放「<strong>特碼</strong>」「<strong>正碼</strong>」「<strong>正碼特</strong>」「<strong>連碼</strong>」「<strong>七碼</strong>」「<strong>五行</strong>」「<strong>半波</strong>」「<strong>一肖</strong>」「<strong>特肖</strong>」「<strong>合肖</strong>」「<strong>連肖</strong>」「<strong>尾數</strong>」「<strong>連尾</strong>」十三種玩法。
            特碼與正碼各分為 <strong>A / B</strong> 兩個分頁（注項相同、賠率與限額不同）；
            正碼特分為 <strong>正一特 — 正六特</strong> 六個分頁（對應 6 顆正碼的名次）；
            連碼分為 <strong>三全中 / 三中二 / 二全中 / 二中特 / 特串</strong> 五個分頁；
            合肖與連肖各分為 <strong>二肖 — 六肖</strong> 的中／不中多個分頁；
            連尾分為 <strong>二尾 — 四尾</strong> 的連中／連不中多個分頁；
            尾數分為 <strong>尾數中 / 尾數不中</strong> 兩個分頁；七碼與特肖只有一個分頁。
            注單一律記錄所屬分頁，結算時依分頁判定。
          </p>

          <p class="rule-sub-title">特碼 — 以第 7 顆特別號結算</p>
          <div class="play-cards">
            <div v-for="play in PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
              <p class="play-card-example">{{ play.example }}</p>
            </div>
          </div>

          <p class="rule-sub-title">正碼 — 以 {{ CREDIT_ZHENGMA_NORMAL_COUNT }} 顆正碼與七球總和結算</p>
          <div class="play-cards">
            <div v-for="play in ZHENGMA_PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
              <p class="play-card-example">{{ play.example }}</p>
            </div>
          </div>

          <p class="rule-sub-title">正碼特 — 以「指定名次那一顆正碼」結算</p>
          <div class="play-cards">
            <div v-for="play in ZHENGMATE_PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
              <p class="play-card-example">{{ play.example }}</p>
            </div>
          </div>

          <p class="rule-sub-title">連碼 — 自選一組號碼，依命中組成分檔結算</p>
          <div class="play-cards">
            <div v-for="play in LIANMA_PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
              <p class="play-card-example">{{ play.example }}</p>
            </div>
          </div>
          <ul class="rule-list rule-list-tight">
            <li><strong>複式</strong>：選超過一注所需的號碼數會自動展開成多注 —— 例如三全中選 5 個號 =
              C(5,3) = <strong>10 注</strong>，每注獨立結算、獨立扣款，總額 = 注數 × 單注金額。</li>
            <li>連碼的賠率<strong>開獎後才確定</strong>（三中二可能中三或中二），
              下注時會把整份檔次表鎖在注單上，結算依命中檔次派彩。</li>
          </ul>

          <p class="rule-sub-title">七碼 — 以 {{ CREDIT_QIMA_BALL_COUNT }} 顆球的組成顆數結算</p>
          <div class="play-cards">
            <div v-for="play in QIMA_PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
              <p class="play-card-example">{{ play.example }}</p>
            </div>
          </div>
          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 22%" />
                <col style="width: 22%" />
                <col style="width: 18%" />
                <col style="width: 14%" />
                <col style="width: 24%" />
              </colgroup>
              <thead>
                <tr>
                  <th>單雙組合</th>
                  <th>大小組合</th>
                  <th>命中機率</th>
                  <th>賠率</th>
                  <th>{{ SAMPLE_COIN }} 元派彩</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in QIMA_ODDS_ROWS" :key="row.oddEven">
                  <td class="tier-name">{{ row.oddEven }}</td>
                  <td class="tier-name">{{ row.bigSmall }}</td>
                  <td class="tier-match">{{ row.rate }}</td>
                  <td class="tier-odds">{{ row.odds }}</td>
                  <td class="tier-est">{{ actions.money(_handlers.payoutOf(row.odds)) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="rule-note">
            單／大各 25 個號、雙／小各 24 個號，兩組分布相同故共用同一份賠率；
            兩端刻意不對稱（<strong>單7雙0</strong> 比 <strong>單0雙7</strong> 容易開出，賠率較低）。
          </p>

          <p class="rule-sub-title">五行 — 以特別號所屬五行結算（{{ WUXING_YEAR }} {{ ganzhiOfYear(WUXING_YEAR) }}年）</p>
          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 10%" />
                <col style="width: 10%" />
                <col style="width: 12%" />
                <col style="width: 68%" />
              </colgroup>
              <thead>
                <tr>
                  <th>五行</th>
                  <th>號碼數</th>
                  <th>賠率</th>
                  <th>號碼</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in WUXING_ROWS" :key="`wx-${row.name}`">
                  <td class="tier-name">{{ row.name }}</td>
                  <td class="tier-match">{{ row.count }}</td>
                  <td class="tier-odds">{{ row.odds }}</td>
                  <td class="tier-nums">
                    <em v-for="num in row.nums" :key="`wx-${row.name}-${num}`">{{ num }}</em>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="rule-list rule-list-tight">
            <li><strong>號碼逐年輪轉</strong>：五行依六十甲子納音對應號碼，每兩年換一次表
              （{{ WUXING_YEAR }} 年為 {{ ganzhiOfYear(WUXING_YEAR) }}年）。上表為當年適用，結算舊期一律以該期年份的表判定。</li>
            <li>因此各五行的號碼數會變動（8 — 12 個），<strong>賠率也跟著號碼數走</strong>
              （回報率固定 {{ (creditRtpOf('wuxing', 7000) * 100).toFixed(0) }}%），不是固定值。下注時的賠率會鎖在注單上。</li>
          </ul>

          <p class="rule-sub-title">半波 — 色波與大小／單雙的交集，以特別號結算</p>
          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 10%" />
                <col style="width: 10%" />
                <col style="width: 12%" />
                <col style="width: 68%" />
              </colgroup>
              <thead>
                <tr>
                  <th>注項</th>
                  <th>號碼數</th>
                  <th>賠率</th>
                  <th>號碼</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in BANBO_ROWS" :key="`bb-${row.name}`">
                  <td class="tier-name">{{ row.name }}</td>
                  <td class="tier-match">{{ row.count }}</td>
                  <td class="tier-odds">{{ row.odds }}</td>
                  <td class="tier-nums">
                    <em v-for="num in row.nums" :key="`bb-${row.name}-${num}`">{{ num }}</em>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="rule-list rule-list-tight">
            <li>色波的號碼分布固定（紅 17／藍 16／綠 16），<strong>不隨年份變動</strong>，與五行不同。</li>
            <li>各注項號碼數不同（7 — 10 個），所以<strong>賠率逐項不同</strong>；每期恰好會有
              <strong>2 個半波注項中獎</strong>（該色的大小一個、單雙一個）。</li>
            <li><strong>不設和局</strong>：{{ CREDIT_TIE_SPECIAL_NUMBER }} 號屬綠波且為單、為大，已落在既有注項內。</li>
          </ul>

          <p class="rule-sub-title">一肖 — 以特別號所屬生肖結算（{{ YIXIAO_YEAR }} {{ YIXIAO_ANIMAL }}年）</p>
          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 8%" />
                <col style="width: 9%" />
                <col style="width: 12%" />
                <col style="width: 13%" />
                <col style="width: 58%" />
              </colgroup>
              <thead>
                <tr>
                  <th>生肖</th>
                  <th>號碼數</th>
                  <th>一肖中</th>
                  <th>一肖不中</th>
                  <th>號碼</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in YIXIAO_ROWS" :key="`yx-${row.name}`">
                  <td class="tier-name">{{ row.name }}</td>
                  <td class="tier-match">{{ row.count }}</td>
                  <td class="tier-odds">{{ row.hitOdds }}</td>
                  <td class="tier-odds">{{ row.missOdds }}</td>
                  <td class="tier-nums">
                    <em v-for="num in row.nums" :key="`yx-${row.name}-${num}`">{{ num }}</em>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="rule-list rule-list-tight">
            <li><strong>一肖中</strong>：特別號屬所選生肖即中獎。<strong>一肖不中</strong>：特別號<strong>不屬</strong>所選生肖才中獎
              —— 兩者共用同一份號碼，但中獎方向相反。</li>
            <li><strong>號碼逐年輪轉</strong>：01 給當年生肖再往回推，<strong>49 也歸當年生肖</strong>，
              因此當年生肖（{{ YIXIAO_ANIMAL }}）有 5 個號、其餘 11 個各 4 個。結算舊期一律以該期年份的表判定。</li>
            <li>號碼數變動 → <strong>賠率也跟著變</strong>（回報率固定 {{ (creditRtpOf('yixiao', 10000) * 100).toFixed(0) }}%）：
              一肖中 4 個號賠 11.88、5 個號賠 9.51；一肖不中則是 1.06 / 1.08。下注時的賠率會鎖在注單上。</li>
            <li><strong>不設和局</strong>：{{ CREDIT_TIE_SPECIAL_NUMBER }} 號已歸屬當年生肖，落在既有注項內。</li>
          </ul>

          <p class="rule-sub-title">特肖 — 只看特別號所屬生肖結算（與一肖中同賠率公式）</p>
          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 10%" />
                <col style="width: 10%" />
                <col style="width: 12%" />
                <col style="width: 68%" />
              </colgroup>
              <thead>
                <tr>
                  <th>生肖</th>
                  <th>號碼數</th>
                  <th>賠率</th>
                  <th>號碼</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in TEXIAO_ROWS" :key="`tx-${row.name}`">
                  <td class="tier-name">{{ row.name }}</td>
                  <td class="tier-match">{{ row.count }}</td>
                  <td class="tier-odds">{{ row.odds }}</td>
                  <td class="tier-nums">
                    <em v-for="num in row.nums" :key="`tx-${row.name}-${num}`">{{ num }}</em>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="rule-list rule-list-tight">
            <li>判定與賠率公式皆與<strong>一肖中</strong>相同 —— 只看特別號一顆球，中獎面 4 — 5 個號，
              賠率隨當年號碼數變動（回報率固定 {{ (creditRtpOf('texiao', 11000) * 100).toFixed(0) }}%）。</li>
            <li>只有一個分頁（無中／不中之分）；<strong>不設和局</strong>：49 已歸屬當年生肖，落在既有注項內。</li>
          </ul>

          <p class="rule-sub-title">合肖 — 自選 n 個生肖，特別號所屬生肖「屬於 / 不屬於」該組結算</p>
          <div class="play-cards">
            <div v-for="play in HEXIAO_PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
            </div>
          </div>
          <ul class="rule-list rule-list-tight">
            <li>只看特別號一顆球，所選生肖是「<strong>或</strong>」的關係 —— 與連肖（且的關係）不同。</li>
            <li>同一組生肖的「n肖中」與「n肖不中」機率相加恰為 100%（嚴格互補）。</li>
            <li>賠率不固定：<strong>選到當年生肖與否會讓賠率差一截</strong>（該生肖多 1 個號），
              上表「賠率」為實際區間，下注時的賠率會依當下選取即時算出並鎖在注單上。</li>
          </ul>

          <p class="rule-sub-title">連肖 — 自選 n 個生肖，是否全部出現在 7 顆球中結算</p>
          <div class="play-cards">
            <div v-for="play in LIANXIAO_PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
            </div>
          </div>
          <ul class="rule-list rule-list-tight">
            <li>看整期 7 顆球（6 正碼＋特別號），所選生肖是「<strong>且</strong>」的關係 —— 與合肖（或的關係）不同。</li>
            <li><strong>連不中不是連中的反面</strong>：連中的反面是「至少一個沒出現」，連不中要求「全部都沒出現」，
              中間還夾著「部分出現」，兩者機率相加 <strong>&lt; 100%</strong>。</li>
            <li>賠率不固定：<strong>選到當年生肖與否會讓賠率差約兩成</strong>，上表「賠率」為實際區間，
              下注時的賠率會依當下選取即時算出並鎖在注單上。</li>
          </ul>

          <p class="rule-sub-title">尾數 — 以特別號尾數（個位數）結算</p>
          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 8%" />
                <col style="width: 9%" />
                <col style="width: 12%" />
                <col style="width: 13%" />
                <col style="width: 58%" />
              </colgroup>
              <thead>
                <tr>
                  <th>尾數</th>
                  <th>號碼數</th>
                  <th>尾數中</th>
                  <th>尾數不中</th>
                  <th>號碼</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in WEISHU_ROWS" :key="`ws-${row.name}`">
                  <td class="tier-name">{{ row.name }}</td>
                  <td class="tier-match">{{ row.count }}</td>
                  <td class="tier-odds">{{ row.hitOdds }}</td>
                  <td class="tier-odds">{{ row.missOdds }}</td>
                  <td class="tier-nums">
                    <em v-for="num in row.nums" :key="`ws-${row.name}-${num}`">{{ num }}</em>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="rule-list rule-list-tight">
            <li><strong>尾數中</strong>：特別號尾數（個位數）屬所選尾即中獎。<strong>尾數不中</strong>：特別號尾數
              <strong>不屬</strong>所選尾才中獎 —— 兩者共用同一份號碼，但中獎方向相反。</li>
            <li>號碼分布固定不隨年份輪轉（與一肖不同）：<strong>0 尾只有 4 個號</strong>（10/20/30/40），其餘 9 個尾各 5 個號，
              因此賠率逐尾不同（回報率固定 {{ (creditRtpOf('weishu', 15000) * 100).toFixed(0) }}%）。下注時的賠率會鎖在注單上。</li>
            <li><strong>不設和局</strong>：49 屬 9 尾，已落在既有注項內。</li>
          </ul>

          <p class="rule-sub-title">連尾 — 自選 n 個尾數，是否全部出現在 7 顆球中結算</p>
          <div class="play-cards">
            <div v-for="play in LIANWEI_PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
            </div>
          </div>
          <ul class="rule-list rule-list-tight">
            <li>看整期 7 顆球（6 正碼＋特別號），所選尾數是「<strong>且</strong>」的關係，判定邏輯與連肖相同，
              只是選的是<strong>尾數（0 ~ 9）</strong>而非生肖。</li>
            <li><strong>連不中不是連中的反面</strong>：連中的反面是「至少一個沒出現」，連不中要求「全部都沒出現」，
              中間還夾著「部分出現」，兩者機率相加 <strong>&lt; 100%</strong>。</li>
            <li>賠率不固定：<strong>選到 0 尾與否會讓賠率差約兩成</strong>（0 尾只有 4 個號，其餘各 5 個），
              上表「賠率」為實際區間，下注時的賠率會依當下選取即時算出並鎖在注單上。</li>
          </ul>

          <p class="rule-sub-title">各分頁賠率與投注限額</p>
          <div class="rule-table-wrap">
            <table class="rule-table">
              <thead>
                <tr>
                  <th>玩法 / 分頁</th>
                  <th>賠率</th>
                  <th>單注金額</th>
                  <th>單期上限</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in TAB_ROWS" :key="`${row.playName}-${row.tabName}`">
                  <td class="tier-name">{{ row.playName }} · {{ row.tabName }}</td>
                  <td class="tier-odds">
                    <span v-for="item in row.odds" :key="item.groupName" class="odds-chip">
                      {{ item.groupName }} {{ item.odds }}
                    </span>
                  </td>
                  <td class="tier-est">{{ actions.money(row.itemMin) }} — {{ actions.money(row.itemMax) }}</td>
                  <td class="tier-hint">{{ row.issueMax > 0 ? actions.money(row.issueMax) : '不限' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul class="rule-list rule-list-tight">
            <li>同玩法的 <strong>A / B 分頁注項相同但賠率與限額不同</strong>（B 盤為大額投注，額度較高、賠率較低），
              下注時的賠率會鎖定在注單上。</li>
            <li><strong>單注金額</strong>需在該分頁區間內，<strong>單期上限</strong>以「同一期、同一分頁」累計計算，超限整筆不受理。</li>
            <li>每注可<strong>獨立設定金額</strong>，總扣款 = 各注金額加總，<strong>下注即扣款</strong>。</li>
            <li><strong>隨機選號</strong>：可指定注數由系統機選號碼球，或一鍵清空。</li>
            <li><strong>號碼推薦</strong>：依「攪出次數 / 相隔期數」落差推薦 6 碼，可一鍵加入注項。</li>
            <li><strong>自動投注</strong>：開啟後每期開盤自動隨機下注指定注數，餘額不足會自動跳過該期。</li>
          </ul>
        </div>

        <!-- 獎金結構 -->
        <div id="cd-section-prize" class="rule-section">
          <h4 class="rule-title">獎金結構</h4>
          <p class="rule-note">
            派彩 = <strong>注金 × 賠率</strong>，<strong>賠率含本金</strong>（下注時已扣款）。<br>
            以下派彩範例以每注 {{ SAMPLE_COIN }} 元計算。
          </p>
          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 18%" />
                <col style="width: 30%" />
                <col style="width: 12%" />
                <col style="width: 18%" />
                <col style="width: 22%" />
              </colgroup>
              <thead>
                <tr>
                  <th>玩法</th>
                  <th>中獎條件</th>
                  <th>賠率</th>
                  <th>{{ SAMPLE_COIN }} 元派彩</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in PRIZE_ROWS" :key="row.name">
                  <td class="tier-name">{{ row.name }}</td>
                  <td class="tier-match">{{ row.condition }}</td>
                  <td class="tier-odds">{{ row.odds }}</td>
                  <td class="tier-est">
                    {{ actions.money(_handlers.payoutOf(row.odds)) }}
                    <span class="tier-profit">（淨利 {{ actions.money(_handlers.profitOf(row.odds)) }}）</span>
                  </td>
                  <td class="tier-hint">{{ row.hint }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="rule-list rule-list-tight">
            <li>結算後派彩會進入<strong>可領獎金</strong>，需在「下注紀錄」點選「<strong>領取中獎獎金</strong>」才會入帳。</li>
            <li>領獎<strong>一次領一期</strong>，由最早未領取的期數開始。</li>
            <li>和局（退還本金）同樣列入可領金額。</li>
          </ul>
        </div>

        <!-- 獎池滾存 -->
        <div id="cd-section-jackpot" class="rule-section">
          <h4 class="rule-title">獎池、滾存與爆池發放</h4>
          <ul class="rule-list">
            <li>賠率派彩由莊家支付，<strong>不從獎池扣款</strong>；獎池改由每筆投注<strong>抽水
                {{ (CREDIT_JACKPOT.rakeRatio * 100).toFixed(0) }}%</strong> 累積。</li>
            <li><strong>爆池期</strong>：特別號開出 <strong>{{ CREDIT_JACKPOT.hitNumber }}</strong> 時發放，
              發放金額 = 可發放累積池 × <strong>{{ (CREDIT_JACKPOT.payoutRatio * 100).toFixed(0) }}%</strong>，其餘滾存至下期。</li>
            <li>可發放累積池 = <strong>當期抽水 ＋ 累積滾存</strong>（不含頁首展示用的池底金額）。</li>
            <li>累積池未達 <strong>{{ actions.money(CREDIT_JACKPOT.minPool) }}</strong> 或該期無人有份時<strong>不發放</strong>，整池滾存至下期。
            </li>
            <li>爆池期由該期<strong>有份的注單依「注金 × 權重」比例分配</strong>；
              <strong>有份 = 該期非未中的注單</strong>（中獎或和局皆可），未中則無份。</li>
            <li>權重<strong>依玩法與注項群組而定</strong>，愈難命中權重愈高（依理論賠率分級：≥ 20 為 3、2.5 ~ 20 為 2、&lt; 2.5 為 1）。
              七碼同一群組內難易差距大（單4雙3 近 30%、單0雙7 僅 0.4%），故逐項給權重。</li>
            <li>加碼金額與賠率派彩合併計入該期<strong>可領獎金</strong>，於「下注紀錄」一併領取。</li>
          </ul>

          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 26%" />
                <col style="width: 48%" />
                <col style="width: 26%" />
              </colgroup>
              <thead>
                <tr>
                  <th>玩法</th>
                  <th>注項群組</th>
                  <th>分配權重</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in JACKPOT_WEIGHT_ROWS" :key="`${row.playName}-${row.groupName}`">
                  <td class="tier-name">{{ row.playName }}</td>
                  <td class="tier-match">{{ row.groupName }}</td>
                  <td class="tier-odds">× {{ row.weight }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pool-rows">
            <div class="pool-row">
              <span class="pool-label">當期抽水</span>
              <span class="pool-value pool-value-current">{{ actions.money(currentIssuePool) }} F幣</span>
            </div>
            <div class="pool-row">
              <span class="pool-label">累積滾存</span>
              <span class="pool-value pool-value-base">{{ actions.money(carryPool) }} F幣</span>
            </div>
            <div class="pool-row">
              <span class="pool-label">可發放累積池</span>
              <span class="pool-value">{{ actions.money(distributablePool) }} F幣</span>
            </div>
            <div class="pool-row pool-row-total">
              <span class="pool-label">預估獎金</span>
              <span class="pool-value">{{ actions.money(estimatedPayout) }} F幣</span>
            </div>
          </div>
          <p class="rule-note">
            上次獎金：
            <template v-if="lastHit">
              <strong>第{{ lastHit.issue }}期</strong>，發放 <strong>{{ actions.money(lastHit.payout) }}</strong>，
              {{ lastHit.winners }} 人 / {{ lastHit.orders }} 注分配（該期累積池 {{ actions.money(lastHit.pool) }}）
            </template>
            <template v-else>尚未發放</template>
            ｜頁首「總獎金」= 池底（展示） ＋ 可發放累積池 = {{ actions.money(totalPool) }} F幣
          </p>
        </div>

        <!-- 特別說明 -->
        <div id="cd-section-note" class="rule-section rule-section-last">
          <h4 class="rule-title">特別說明</h4>
          <ul class="rule-list">
            <li>特別號開出 <strong>{{ CREDIT_TIE_SPECIAL_NUMBER }}</strong> 號時，特碼兩面（大小／單雙／合單雙／尾大小）<strong>全部視為和局</strong>，退還本金；
              正碼特兩面同規則，但看的是<strong>該名次的正碼</strong>是否為 {{ CREDIT_TIE_SPECIAL_NUMBER }}。
            </li>
            <li><strong>色波不設和局</strong>：{{ CREDIT_TIE_SPECIAL_NUMBER }} 號屬綠波，投注綠波仍算中獎（特碼與正碼特皆同）。</li>
            <li>每注<strong>獨立結算</strong>：特碼僅看特別號、與 6 顆正碼無關；正碼僅看
              {{ CREDIT_ZHENGMA_NORMAL_COUNT }} 顆正碼、與特別號無關（總和則含特別號）；
              正碼特<strong>只看所選分頁對應名次的那一顆</strong>，開在其他名次不算中獎。</li>
            <li><strong>正碼、連碼與七碼不設和局</strong>：開出 {{ CREDIT_TIE_SPECIAL_NUMBER }} 號時，正碼單號命中照賠、總和兩面照常判定；
              七碼一律以 {{ CREDIT_QIMA_BALL_COUNT }} 顆球的組成顆數判定，組合需<strong>完全相同</strong>才算中獎。</li>
            <li><strong>連碼一注多號、合肖／連肖一注多生肖、連尾一注多尾數</strong>：同一注內不得重複，數量需與該分頁規格相符（三選 3 個、二選 2 個…）；
              複式送單時<strong>每注獨立扣款、獨立結算</strong>，不會因為其中一注中獎而影響其他注。</li>
            <li>封盤後送出的投注<strong>不予受理</strong>，請在開盤期間內完成下注。</li>
            <li>賠率可依營運需求調整，結算<strong>以下注時記錄在注單上的賠率為準</strong>（可於下注紀錄查閱）。</li>
            <li>尚未開放的玩法若經由其他管道下注，結算時一律<strong>退還本金</strong>。</li>
            <li>爆池分配權重<strong>依玩法設定</strong>（見「獎池滾存」章節的權重表），
              下注時不鎖定，結算時以當下設定為準。</li>
            <li>開獎結果以系統公布為準，如對結果有疑問請聯繫客服。</li>
          </ul>
        </div>
      </div>

      <button type="button" class="back-top-btn" @click="click.backTop">↑ TOP</button>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* 樣式自帶（scoped）：避免與 6hc-of 頁的同名樣式互相覆蓋 */
.cd-rule-mask {
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.cd-rule-dialog {
  width: min(820px, 96vw);
  max-height: 88vh;
  overflow: auto;
  border: 4px solid #7f1d1d;
  border-radius: 8px;
  background: #fff;
  padding: 0.75rem;

  .cd-rule-header {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 14px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .close-btn {
      position: absolute;
      top: -3px;
      right: 5px;
      border: none;
      background: none;
      font-size: 25px;
      font-weight: 700;
      line-height: 1;
      color: var(--color-red-desc);
      cursor: pointer;

      &:hover {
        color: var(--color-red-main);
      }
    }
  }

  .cd-rule-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid #fee2e2;
    border-bottom: unset;
    border-radius: 6px 6px 0 0;
    background: #fff5f6;

    .cd-rule-nav-btn {
      border: 1px solid #f2b7c1;
      border-radius: 999px;
      background: #fff;
      padding: 3px 10px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-red-main);
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: var(--color-red-main);
        color: #fff;
      }
    }
  }

  .cd-rule-body {
    display: grid;
    gap: 18px;

    .rule-section {
      border: 1px solid #fee2e2;
      border-radius: 6px;
      padding: 12px 14px;

      &#cd-section-intro {
        border-radius: 0 0 6px 6px;
      }

      &.rule-section-last {
        margin-bottom: 4px;
      }
    }

    .rule-title {
      margin: 0 0 10px;
      border-left: 3px solid var(--color-red-main);
      padding-left: 8px;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .rule-note {
      margin: 0 0 8px;
      font-size: 12px;
      line-height: 1.6;
      color: var(--color-red-desc);

      strong {
        color: var(--color-red-main);
      }
    }

    .odds-chip {
      display: inline-block;
      margin: 0 4px 2px 0;
      padding: 1px 6px;
      border: 1px solid var(--color-gold);
      border-radius: 4px;
      font-size: 11px;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;
    }

    /* 同一章節內的玩法小標（特碼 / 正碼） */
    .rule-sub-title {
      margin: 12px 0 8px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      display: flex;
      align-items: center;
      gap: 6px;

      &::before {
        content: '';
        width: 4px;
        height: 12px;
        background: var(--color-gold);
      }
    }

    .rule-list {
      margin: 0;
      padding-left: 1.2rem;
      display: grid;
      gap: 5px;
      font-size: 13px;
      line-height: 1.55;
      color: #374151;

      strong {
        color: var(--color-red-main);
      }

      &.rule-list-tight {
        margin-top: 10px;
        font-size: 12px;
      }
    }

    /* 表格共用 */
    .rule-table-wrap {
      overflow-x: auto;
    }

    .rule-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;

      thead th {
        background: var(--color-red-main);
        padding: 6px 8px;
        text-align: center;
        white-space: nowrap;
        font-weight: 600;
        color: #fff;
      }

      tbody td {
        border-bottom: 1px solid #fee2e2;
        padding: 6px 8px;
        text-align: center;
        color: #374151;
      }

      tbody tr:last-child td {
        border-bottom: none;
      }

      tbody tr:hover td {
        background: #fff5f6;
      }
    }

    .td-range {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      font-weight: 600;
      color: var(--color-red-desc);
    }

    .status-badge {
      display: inline-block;
      border-radius: 0.25rem;
      padding: 1px 6px;
      font-size: 11px;
      font-weight: 600;
      background: #f3f4f6;
      color: #374151;

      &.status-開盤中 {
        background: #dcfce7;
        color: #15803d;
      }

      &.status-正在開獎中 {
        background: #fef9c3;
        color: #92400e;
      }

      &.status-已開獎 {
        background: #fee2e2;
        color: var(--color-red-main);
      }

      &.status-已封盤 {
        background: #f3f4f6;
        color: #6b7280;
      }
    }

    /* 玩法卡片 */
    .play-cards {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));

      .play-card {
        border: 1px solid #f3b7bf;
        border-radius: 6px;
        padding: 10px 12px;
        background: #fff5f6;

        .play-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 6px;

          .play-card-name {
            font-size: 13px;
            font-weight: 700;
            color: var(--color-red-main);
          }

          .play-card-odds {
            border: 1px solid #fbbf24;
            border-radius: 999px;
            background: #fffbeb;
            padding: 1px 8px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            color: #b45309;
          }
        }

        .play-card-rule {
          margin: 0 0 4px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-red-desc);
        }

        .play-card-desc {
          margin: 0 0 4px;
          font-size: 12px;
          line-height: 1.5;
          color: #374151;
        }

        .play-card-example {
          margin: 0;
          font-size: 11px;
          font-style: italic;
          color: var(--color-red-desc);
        }
      }
    }

    /* 獎金結構 */
    .prize-table {
      .tier-name {
        font-weight: 700;
        color: var(--color-red-main);
      }

      .tier-match {
        font-weight: 600;
      }

      .tier-odds {
        font-size: 14px;
        font-weight: 700;
        color: #d97706;
      }

      .tier-est {
        font-size: 13px;
        font-weight: 700;
        color: #15803d;

        .tier-profit {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
        }
      }

      .tier-hint {
        font-size: 11px;
        color: #6b7280;
      }

      /* 五行 / 半波：注項涵蓋的號碼 */
      .tier-nums {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        text-align: left;

        em {
          min-width: 22px;
          border: 1px solid #f3b7bf;
          border-radius: 3px;
          background: #fff;
          padding: 0 3px;
          font-size: 11px;
          font-style: normal;
          font-weight: 600;
          color: var(--color-red-desc);
          font-variant-numeric: tabular-nums;
        }
      }
    }

    /* 獎池 */
    .pool-rows {
      display: grid;
      gap: 4px;
      margin-top: 10px;
      border: 1px solid #fde68a;
      border-radius: 6px;
      background: #fffbf0;
      padding: 8px 10px;

      .pool-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;

        .pool-label {
          font-weight: 600;
          color: var(--color-red-desc);
        }

        .pool-value {
          font-size: 13px;
          font-weight: 700;
          color: #d97706;

          &.pool-value-base {
            font-weight: 600;
            color: #6b7280;
          }

          &.pool-value-current {
            color: #15803d;
          }
        }

        &.pool-row-total {
          margin-top: 4px;
          border-top: 1px dashed #fde68a;
          padding-top: 6px;

          .pool-label {
            font-size: 13px;
            color: var(--color-red-main);
          }

          .pool-value {
            font-size: 15px;
            color: var(--color-red-main);
          }
        }
      }
    }
  }

  .back-top-btn {
    position: sticky;
    bottom: 12px;
    left: 100%;
    display: block;
    width: fit-content;
    margin-top: 10px;
    border: none;
    border-radius: 999px;
    background: var(--color-red-main);
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    transition: opacity 0.15s;

    &:hover {
      opacity: 0.85;
    }
  }
}
</style>
