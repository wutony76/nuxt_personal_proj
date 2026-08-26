<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { GET_CONT } from '../config/constants'
import { useRouter } from 'vue-router'
import { api } from '../services/api'
import type { LobbyItem } from '../types/lottery'

useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=cwTeXKai&family=JetBrains+Mono:wght@400;500&family=Bebas+Neue&display=swap',
    },
  ],
})

/**
 * 各玩法的卡片文案
 * en / desc            —— 該玩法兩種模式共用的值（en 另供左側玩法導覽使用）
 * enByMode / descByMode —— 指定模式專屬的值（key 為 MODE_META 的 suffix），沒寫就退回上面共用的
 *
 * ⚠️ 這些覆寫要掛在玩法底下、不要掛在 MODE_META：大廳目前有 4 個玩法但只有 6HC / K3 有這些文案，
 *    掛在模式上會讓其餘 2 個玩法的卡片也跟著被套用。
 *
 * desc 為選填：每個盤口都用 descByMode 指定完了就不需要共用那份（K3 就是這種寫法）。
 */
const GAME_META: Record<string, {
  en: string
  ribbon: string
  desc?: string
  enByMode?: Record<string, string>
  descByMode?: Record<string, string>
}> = {
  '6HC': {
    en: 'LHC',
    ribbon: 'BG · 49 取 7',
    enByMode: {
      OF: 'LHC [OF]',
      CD: 'LHC [CD]',
    },
    desc: '凡局開時不問名，\n自有規章定分明。\n一念無私循序轉，\n萬機皆在信中行。',
    descByMode: {
      OF: '啟局依章守其規，\n明文立矩定輸贏。\n公心一秤分高下，\n萬象皆依信而成。',
    },
  },
  K3: {
    en: 'K3',
    ribbon: 'BG · 3 骰子點數組合',
    enByMode: {
      OF: 'K3 [OF]',
      CD: 'K3 [CD]',
    },
    descByMode: {
      OF: '三骰落定乾坤現，\n點數分明照章行。\n大小單雙皆有序， \n一擲落定自分明。',
      CD: '六面藏機隨數轉，\n骰落之時見真章。\n點數分明藏變化， \n一擲落定判輸贏。',
    },
  },
  PK10: {
    en: 'PK10',
    ribbon: 'BG · 10 碼名次競逐',
    enByMode: {
      OF: 'PK10 [OF]',
      CD: 'PK10 [CD]',
    },
    descByMode: {
      OF: '十碼開局定次序，\n名次分明照規行。\n大小單雙皆有序，\n落定之時見輸贏。',
      CD: '十碼縱橫藏變數，\n排位之間見真章。\n前後名次多變化，\n一局開落定輸贏。',
    },
  },
  SSC: {
    en: 'SSC',
    ribbon: 'BG · 5 球數字定位',
    enByMode: {
      OF: 'SSC [OF]',
      CD: 'SSC [CD]',
    },
    descByMode: {
      OF: '五球開時定其位，\n數字分明照章行。\n大小單雙皆有序，\n落定之時見輸贏。',
      CD: '五球縱橫藏變數，\n位次之間見真章。\n組合分明多變化，\n一局開落定輸贏。',
    },
  },
  X5: {
    en: 'X5',
    ribbon: 'BG · 11 選 5 不重複',
    enByMode: {
      OF: 'X5 [OF]',
      CD: 'X5 [CD]',
    },
    descByMode: {
      OF: '十一開五定其位，\n直組任選照章行。\n膽拖不定皆有序，\n落定之時見輸贏。',
      CD: '十一藏機開五碼，\n號無重複見真章。\n大小單雙皆有序，\n一局落定判高低。',
    },
  },
  EGGS: {
    en: 'EGGS',
    ribbon: 'BG · 3 球 0~9 組合',
    desc: '三球輪轉見天機，\n點數分明照式提。\n大小單雙皆有序，\n一局開落定高低。',
  },
  KL10: {
    en: 'KL10',
    ribbon: 'BG · 20 取 8 不重複',
    desc: '廿碼藏鋒開八數，\n正和龍虎任選陳。\n上下奇偶分兩面，\n一輪落定見輸贏。',
  },
  KL8: {
    en: 'KL8',
    ribbon: 'BG · 80 選 20 開號',
    desc: '八十藏珠開廿號，\n任選兩面各成章。\n和值上下奇偶判，\n五行流轉定高低。',
  },
  FC3D: {
    en: 'FC3D',
    ribbon: 'BG · 3 位數字定位',
    desc: '三位開時定其形，\n直組和值照章明。\n不定大小皆有序，\n一局落定見輸贏。',
  },
  PL3: {
    en: 'PL3',
    ribbon: 'BG · 3 位數字排列',
    desc: '三位排定見分曉，\n直組和值細推敲。\n不定大小皆可選，\n一局落定見輸贏。',
  },
}

const MODE_META = [
  { suffix: 'OF', theme: 'of', mark: '官', label: '官 方', tag: 'OFFICIAL · MODE', note: '獎池分層 · 正碼命中派彩' },
  { suffix: 'CD', theme: 'cd', mark: '信', label: '信 用', tag: 'CREDIT · MODE', note: '每注獨立 · 賠率即時派彩' },
]

/**
 * 玩法的模式覆寫表：預設每個玩法都有官方／信用兩張卡（走 MODE_META）。
 *
 * PC蛋蛋（bglottery 來源）只有信用模式、沒有官方盤 —— 硬套 MODE_META 會多生一張
 * 「EGGS-OF」卡但 ROUTE_DICT／GAME_META 都沒有對應資料。這裡讓玩法可以指定「只出這幾張卡」，
 * suffix 留空代表不分盤口（routeKey 直接是玩法 key，不加 "-OF"／"-CD" 後綴）。
 */
const GAME_MODES: Record<string, typeof MODE_META> = {
  EGGS: [
    { suffix: '', theme: 'cd', mark: '信', label: '信 用', tag: 'CREDIT · MODE', note: '每注獨立 · 賠率即時派彩' },
  ],
  // 快樂十分同 PC蛋蛋：來源只有信用模式
  KL10: [
    { suffix: '', theme: 'cd', mark: '信', label: '信 用', tag: 'CREDIT · MODE', note: '每注獨立 · 賠率即時派彩' },
  ],
  // 快樂8同 PC蛋蛋／快樂十分：來源只有信用模式
  KL8: [
    { suffix: '', theme: 'cd', mark: '信', label: '信 用', tag: 'CREDIT · MODE', note: '每注獨立 · 賠率即時派彩' },
  ],
  // 福彩3D只有官方模式（來源無信用盤）；已接上三星直選分層彩池與全站爆池
  FC3D: [
    { suffix: '', theme: 'of', mark: '官', label: '官 方', tag: 'OFFICIAL · MODE', note: '每注獨立 · 固定賠率結算' },
  ],
  // 排列3同福彩3D：只有官方模式（來源無信用盤）；已接上三星直選分層彩池與全站爆池
  PL3: [
    { suffix: '', theme: 'of', mark: '官', label: '官 方', tag: 'OFFICIAL · MODE', note: '每注獨立 · 固定賠率結算' },
  ],
}

const router = useRouter()

const ROUTE_DICT: Record<string, string> = {
  '6HC-CD': '/lottery/bg/6hc-cd',
  '6HC-OF': '/lottery/bg/6hc-of',
  'K3-CD': '/lottery/bg/k3-cd',
  'K3-OF': '/lottery/bg/k3-of',
  'PK10-CD': '/lottery/bg/pk10-cd',
  'PK10-OF': '/lottery/bg/pk10-of',
  'SSC-CD': '/lottery/bg/ssc-cd',
  'SSC-OF': '/lottery/bg/ssc-of',
  'X5-CD': '/lottery/bg/11x5-cd',
  'X5-OF': '/lottery/bg/11x5-of',
  'EGGS': '/lottery/bg/egg',
  'KL10': '/lottery/bg/kl10',
  'KL8': '/lottery/bg/kl8',
  'FC3D': '/lottery/bg/fc3d',
  'PL3': '/lottery/bg/pl3',
}

const state = reactive({
  list: [] as LobbyItem[],
  leaving: false,
})

/**
 * 各卡片對應的彩池／爆池總額（供入場鈕上方的跑馬燈數字用）
 *
 * ⚠️ 每張卡片背後的池子形狀都不一樣，這裡只取「該分頁公開 API 已經算好的可派發總額」，
 *    不重算任何伺端才有的阻尼公式：
 *   - 有 `distributable` 欄位的直接讀該值（CreditJackpotState／SharedPoolState 系列）。
 *   - 6hc-of／6hc-cd 的 jackpot API 沒有回 `distributable`（見 server/api/lottery/
 *     6hc-of|6hc-cd/jackpot.get.ts），改用「當期抽水 + 滾存」近似顯示。
 *   - k3／pk10／ssc／x5 的官方盤各有「爆池」（cd/of 共吃，`jackpotXxx()`）與「共用彩池」
 *     （cd/of 共用同一份，官方盤吃池分頁拿去分層派彩，`poolXxxOf()`，見各自新增的
 *     `server/api/lottery/{k3,pk10,ssc,x5}-of/pool.get.ts`）兩個獨立的池，CD／OF 卡片
 *     背後是同一對池子，兩張卡都顯示相加後的同一個總額。
 *   - eggs／kl10／kl8／pl3／fc3d 同樣各自有「爆池」與「分層彩池」兩個獨立的池，兩者相加顯示成一個總額。
 */
const POOL_FETCHERS: Record<string, () => Promise<number>> = {
  // 6HC-OF／6HC-CD 是兩個完全獨立、各自都有開站種子池底的爆池（各自的 jackpotBase 欄位），
  // 不是像 k3/pk10/ssc/x5 那樣兩盤口共用一份。顯示總額＝jackpotBase + 當期抽水 + 滾存，
  // 比照既有 use6hcOfficial.ts／use6hcCredit.ts 的 livePool 算法（純加總，不是伺端拿來判斷
  // 要不要重骰種子池底用的 jackpotCalc 阻尼公式，兩者用途不同）。
  '6HC-OF': async () => {
    const r = await api.lottery.jackpot6hcOf()
    return Number(r?.jackpotBase ?? 0) + Number(r?.currentIssueJackpot ?? 0) + Number(r?.carryJackpot ?? 0)
  },
  '6HC-CD': async () => {
    const r = await api.lottery.jackpot6hcCd()
    return Number(r?.jackpotBase ?? 0) + Number(r?.currentIssueJackpot ?? 0) + Number(r?.carryJackpot ?? 0)
  },
  // K3/PK10/SSC/X5 的官方盤有兩個池：爆池（cd/of 共吃）＋共用彩池（cd/of 共用，官方盤吃池
  // 分頁用來分層派彩），CD／OF 兩張卡背後是同一對池子，兩張卡加總後顯示同一個總額
  'K3-CD': async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotK3Cd(), api.lottery.poolK3Of()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  'K3-OF': async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotK3Of(), api.lottery.poolK3Of()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  'PK10-CD': async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotPk10Cd(), api.lottery.poolPk10Of()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  'PK10-OF': async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotPk10Of(), api.lottery.poolPk10Of()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  'SSC-CD': async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotSscCd(), api.lottery.poolSscOf()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  'SSC-OF': async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotSscOf(), api.lottery.poolSscOf()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  'X5-CD': async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotX5Cd(), api.lottery.poolX5Of()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  'X5-OF': async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotX5Of(), api.lottery.poolX5Of()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  EGGS: async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotEggs(), api.lottery.poolEggs()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  KL10: async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotKl10(), api.lottery.poolKl10()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  KL8: async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotKl8(), api.lottery.poolKl8()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  PL3: async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotPl3(), api.lottery.poolPl3()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
  FC3D: async () => {
    const [jackpot, pool] = await Promise.all([api.lottery.jackpotFc3d(), api.lottery.poolFc3d()])
    return Number(jackpot?.distributable ?? 0) + Number(pool?.distributable ?? 0)
  },
}

/** 卡片顯示用的彩池數字（動畫跑到的當前值），key 為 card.routeKey */
const displayPools = reactive<Record<string, number>>({})
const _poolRaf: Record<string, number> = {}
const POOL_ANIM_MS = 4000

/** 池額跳動動畫（與各玩法頁首的池額動畫同一套手法），變大變小都用 ease-out 跑過去 */
const _animatePoolTo = (key: string, target: number) => {
  if (_poolRaf[key] != null) cancelAnimationFrame(_poolRaf[key])
  const from = Number(displayPools[key] ?? 0)
  const diff = target - from
  if (Math.abs(diff) < 0.01) {
    displayPools[key] = target
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - start) / POOL_ANIM_MS, 1)
    const ease = 1 - Math.pow(1 - t, 3)
    displayPools[key] = Number((from + diff * ease).toFixed(2))
    if (t < 1) {
      _poolRaf[key] = requestAnimationFrame(step)
    } else {
      delete _poolRaf[key]
    }
  }
  _poolRaf[key] = requestAnimationFrame(step)
}

/** 逐一取回各卡片的彩池總額並套動畫；單一彩種取失敗不影響其他卡片 */
const _fetchPools = async () => {
  await Promise.all(Object.entries(POOL_FETCHERS).map(async ([key, fetcher]) => {
    try {
      _animatePoolTo(key, await fetcher())
    } catch { /* 該彩種彩池取不到不阻斷畫面，維持上一次的顯示值 */ }
  }))
}

let poolTimer: ReturnType<typeof setInterval> | null = null

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 })

/**
 * 全站總彩池（Hero 區塊的大數字）＝所有卡片目前顯示的彩池加總。
 * ⚠️ 直接加總 displayPools，不特別為 k3/pk10/ssc/x5 的 CD／OF 共用池去重——
 *    這兩張卡本來就刻意顯示同一個合計數字（見 POOL_FETCHERS 註解），此處延用同一個簡化前提，
 *    純粹是大廳的裝飾性總覽數字，不是精算的資金帳目。
 * 因為 displayPools 的每個值都在用 requestAnimationFrame 跑動畫，這裡不用另外做動畫，
 * 加總會隨著任一張卡片跳動自然跟著平滑變化。
 */
const totalPool = computed(() =>
  Object.values(displayPools).reduce((sum, value) => sum + Number(value ?? 0), 0)
)

/** Hero 區塊玩法圖示分兩欄顯示要用的列數（欄優先排列，見 .hall-hero__icons 的 grid-auto-flow: column） */
const heroIconRows = computed(() => Math.max(1, Math.ceil(state.list.length / 2)))

const _handlers = {
  enterDelay: (base: number, idx: number, step = 0.12) => `${base + idx * step}s`,
  /** 該卡片的玩法有沒有彩池／爆池可顯示（fc3d 沒有，不列進 POOL_FETCHERS） */
  hasPool: (routeKey: string) => routeKey in POOL_FETCHERS,
  buildCards: (list: LobbyItem[]) =>
    list.flatMap((item, gameIdx) => {
      const modes = GAME_MODES[item.key] ?? MODE_META
      return modes.map(mode => {
        // 單一模式的玩法（suffix 留空）：routeKey 直接是玩法 key，不加 "-OF"／"-CD" 後綴
        const routeKey = mode.suffix ? `${item.key}-${mode.suffix}` : item.key
        return {
          routeKey,
          theme: mode.theme,
          mark: mode.mark,
          label: mode.label,
          tag: mode.tag,
          note: mode.note,
          name: item.name,
          // 卡片的 en 可依模式覆寫（6HC 分成 LHC [OF] / LHC [CD]）；左側玩法導覽仍用共用的 en
          en: GAME_META[item.key]?.enByMode?.[mode.suffix] || GAME_META[item.key]?.en || item.key,
          ribbon: GAME_META[item.key]?.ribbon || '',
          // 該玩法有指定模式專屬題詩就用它（6HC 官方），否則用玩法層共用的
          desc: GAME_META[item.key]?.descByMode?.[mode.suffix] || GAME_META[item.key]?.desc || '',
          serial: `L · ${String(gameIdx + 1).padStart(2, '0')} / ${routeKey}`,
        }
      })
    }),
}

const cards = computed(() => _handlers.buildCards(state.list))

const init = () => {
  state.list = GET_CONT.lotteryAll()
}

const click = {
  start: async (key: string) => {
    if (state.leaving) return
    const target = ROUTE_DICT[key]
    if (!target) return
    state.leaving = true
    await new Promise<void>(resolve => setTimeout(resolve, 500))
    router.push(target)
  },
}

onMounted(() => {
  init()
  _fetchPools()
  poolTimer = setInterval(_fetchPools, 10000)
})

onBeforeUnmount(() => {
  if (poolTimer) clearInterval(poolTimer)
  Object.values(_poolRaf).forEach((id) => cancelAnimationFrame(id))
})
</script>

<template>
  <main class="hall-stage" :class="{ 'is-leaving': state.leaving }">
    <!-- TOP BAR -->
    <header class="hall-top">
      <div class="hall-top__inner">
        <div class="hall-top__left">
          <NuxtLink to="/" class="hall-top__home mono">← HOME</NuxtLink>
          <div class="hall-top__brand">
            <span class="bebas hall-top__year">2026</span>
            <span class="mono hall-top__sub">DRAGON </span>
          </div>
        </div>
        <div class="hall-top__right">
          <div class="bebas hall-top__title">LOTTERY HALL</div>
          <span class="mono hall-top__sub">OFFICIAL × CREDIT · 2026</span>
        </div>
      </div>
    </header>

    <!-- HERO -->
    <section class="hall-hero">
      <div class="hall-hero__particles">
        <span v-for="i in 10" :key="i" class="hall-hero__particle" />
      </div>
      <div class="hall-hero__inner">
        <div class="hall-hero__text">
          <div class="hall-hero__zh">彩 票 大 廳</div>
          <div class="hall-hero__line" />
          <div class="mono hall-hero__en">LOTTERY · HALL · ALL GAMES · 2026</div>
          <div class="mono hall-hero__tagline">凡 局 皆 成 勢 · 萬 數 自 歸 平</div>
        </div>
        <div class="hall-hero__icons">
          <div v-for="(item, idx) in state.list" :key="item.key" class="hall-hero__icon"
            :style="`--enter-delay: ${_handlers.enterDelay(0.55, idx, 0.15)}`">
            <div class="brush hall-hero__dot">{{ item.name.charAt(0) }}</div>
            <div class="hall-hero__icon-txt">
              <b class="brush">{{ item.name }}</b>
              <span class="mono">{{ GAME_META[item.key]?.en || item.key }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- BRUSH DIVIDER -->
    <div class="brush-div">
      <div class="brush-div__inner">
        <span class="mono">∕ 01</span>
        <span class="brush">選 局 入 場</span>
        <span class="mono">CHOOSE · YOUR · GAME</span>
      </div>
    </div>

    <!-- GAMES BAND -->
    <section class="games-band">
      <div class="games-band__head">
        <div class="brush games-band__lt">選 局 入 場</div>
        <div class="games-band__ct">
          <div class="games-band__ct-top">
            <h2 class="bebas">CHOOSE <span class="gold">×</span> GAME</h2>
            <div class="mono games-band__sub">官 方 · 信 用 · 兩 式 同 局</div>
          </div>
          <div class="games-band__ct-bottom">
            <div class="games-pool-band">
              <span class="mono games-pool-band__label">全站總彩池 · TOTAL POOL</span>
              <span class="bebas games-pool-band__val">{{ money(totalPool) }}</span>
            </div>
          </div>
        </div>
        <div class="mono games-band__rt">
          快速開獎 · 即時派彩<br>
          ONLINE · {{ cards.length }} MODES
        </div>
      </div>

      <div class="games-grid">
        <button v-for="(card, idx) in cards" :key="card.routeKey" type="button" class="gc" :class="`gc--${card.theme}`"
          :style="`--enter-delay: ${_handlers.enterDelay(1.05, idx, 0.14)}`">
          <div class="brush gc__big-num">{{ card.mark }}</div>
          <div class="mono gc__meta">{{ card.serial }}</div>
          <h3 class="brush gc__name">{{ card.name }}</h3>
          <div class="bebas gc__en">{{ card.en }}</div>
          <div v-if="card.ribbon" class="gc__tags">
            <span class="mono gc__ribbon">{{ card.ribbon }}</span>
          </div>
          <p class="gc__desc">{{ card.desc }}</p>
          <div class="mono gc__note">{{ card.note }}</div>
          <div v-if="_handlers.hasPool(card.routeKey)" class="gc__pool">
            <span class="mono gc__pool-label"></span>
            <span class="bebas gc__pool-val">{{ money(displayPools[card.routeKey] ?? 0) }}</span>
          </div>
          <span class="gc__enter" @click="click.start(card.routeKey)">
            <span class="brush gc__enter-label">{{ card.label }}</span>
            <span class="mono gc__enter-tag">{{ card.tag }}</span>
          </span>
        </button>
      </div>
    </section>

    <!-- TICKER -->
    <div class="ticker">
      <span class="bebas ticker__lbl">▍ TICKER</span>
      <div class="ticker__band">
        <div class="ticker__track">
          <span class="ticker__item">官方 × 信用 同期同彩</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">即時賠率比對</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">OFFICIAL × CREDIT · 2026</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">DUI CHONG JU</span>
          <span class="ticker__div">◆ ◆ ◆</span>
          <span class="ticker__item">官方 × 信用 同期同彩</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">即時賠率比對</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">OFFICIAL × CREDIT · 2026</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">DUI CHONG JU</span>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <footer class="hall-foot">
      <span>DUI CHONG JU</span>
      <span class="mono hall-foot__copy">Copyright © 2026 HappyFatYoYo All Rights Reserved.</span>
      <span class="mono">BUILD · v2026</span>
    </footer>
  </main>
</template>

<style lang="scss" scoped>
.bebas {
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 0.05em;
}

.brush {
  font-family: 'cwTeXKai', 'Noto Serif TC', serif;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}

/* ===== KEYFRAMES ===== */
@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeSlideUp {
  from {
    transform: translateY(40px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes leaveStage {
  0% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1);
  }

  25% {
    transform: scale(1.01);
    filter: brightness(1.6);
  }

  100% {
    opacity: 0;
    transform: scale(1.03);
    filter: brightness(0.3);
  }
}

@keyframes shimmerText {
  0% {
    background-position: -200% center;
  }

  100% {
    background-position: 200% center;
  }
}

@keyframes heroFloat {

  0%,
  100% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-7px);
  }
}

@keyframes lineExpand {
  from {
    width: 0;
    opacity: 0;
  }

  to {
    width: 80px;
    opacity: 1;
  }
}

@keyframes dotGlow {

  0%,
  100% {
    box-shadow: 0 0 0 2px var(--gold), 0 4px 8px rgba(0, 0, 0, .3);
  }

  50% {
    box-shadow: 0 0 0 2px var(--gold), 0 4px 16px rgba(0, 0, 0, .4), 0 0 22px 4px rgba(245, 200, 66, .45);
  }
}

@keyframes particleRise {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0;
  }

  12% {
    opacity: .9;
  }

  88% {
    opacity: .35;
  }

  100% {
    transform: translateY(-130px) scale(.25);
    opacity: 0;
  }
}

@keyframes tickerScroll {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}

@keyframes cdShimmer {
  0% {
    left: -80%;
    opacity: 0;
  }

  5% {
    opacity: 1;
  }

  45%,
  100% {
    left: 160%;
    opacity: 0;
  }
}

/* ===== STAGE ===== */
.hall-stage {
  --red: var(--color-red-main);
  --red-deep: #7f1d1d;
  --red-wine: #5a0a14;
  --red-ink: #2e060c;
  --red-bright: #b91c1c;
  --gold: var(--color-gold);
  --gold-deep: var(--color-gold);
  --gold-bright: var(--color-yellow-black-btn);
  --paper: #fff5dc;
  --paper-2: #fbe7bd;
  --paper-3: #f5d59a;
  --ivory: #fff9e8;

  width: 100%;
  min-height: 100vh;
  background: var(--red-ink);
  font-family: 'Noto Serif TC', serif;
  color: var(--paper);
  -webkit-font-smoothing: antialiased;
  display: flex;
  flex-direction: column;

  &.is-leaving {
    animation: leaveStage 0.55s ease-in forwards;
    pointer-events: none;
  }
}

/* ===== TOP BAR ===== */
.hall-top {
  background: var(--red-ink);
  border-bottom: 2px solid var(--gold);
  padding: 16px 36px;
  animation: slideDown 0.65s cubic-bezier(.22, .68, 0, 1.2) both;

  &__inner {
    max-width: var(--base-width);
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  &__home {
    font-size: 12px;
    letter-spacing: 0.25em;
    color: var(--gold);
    text-decoration: none;
    transition: color 0.2s;

    &:hover {
      color: var(--gold-bright);
    }
  }

  &__brand {
    display: flex;
    flex-direction: column;
    padding-left: 20px;
    border-left: 1.5px solid var(--gold);
  }

  &__year {
    font-size: 30px;
    color: var(--gold-bright);
    line-height: 0.9;
    letter-spacing: 0.04em;
  }

  &__sub {
    font-size: 10px;
    letter-spacing: 0.28em;
    color: var(--paper-3);
    margin-top: 3px;
  }

  &__right {
    text-align: right;
  }

  &__title {
    font-size: 48px;
    line-height: 0.95;
    letter-spacing: 0.04em;
    background: linear-gradient(90deg,
        var(--gold-bright) 0%,
        #fffef2 38%,
        var(--gold-bright) 52%,
        var(--gold-bright) 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
    animation: shimmerText 3.5s linear 1s infinite;
  }
}

/* ===== HERO ===== */
.hall-hero {
  background:
    radial-gradient(ellipse 1200px 600px at 30% 60%, #c01a26 0%, transparent 60%),
    radial-gradient(ellipse 600px 400px at 90% 20%, #b81222 0%, transparent 60%),
    var(--red);
  padding: 60px 36px 70px;
  position: relative;
  overflow: hidden;
  animation: fadeIn 0.7s ease-out 0.2s both;

  &__particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  &__particle {
    position: absolute;
    border-radius: 50%;
    background: var(--gold-bright);
    animation: particleRise 8s ease-in-out infinite;

    &:nth-child(1) {
      left: 8%;
      bottom: 10%;
      width: 4px;
      height: 4px;
      animation-delay: 0s;
    }

    &:nth-child(2) {
      left: 20%;
      bottom: 5%;
      width: 6px;
      height: 6px;
      animation-delay: 1.4s;
    }

    &:nth-child(3) {
      left: 35%;
      bottom: 20%;
      width: 3px;
      height: 3px;
      animation-delay: 2.8s;
    }

    &:nth-child(4) {
      left: 50%;
      bottom: 8%;
      width: 5px;
      height: 5px;
      animation-delay: 0.7s;
    }

    &:nth-child(5) {
      left: 62%;
      bottom: 28%;
      width: 3px;
      height: 3px;
      animation-delay: 3.5s;
    }

    &:nth-child(6) {
      left: 77%;
      bottom: 14%;
      width: 4px;
      height: 4px;
      animation-delay: 1.9s;
    }

    &:nth-child(7) {
      left: 88%;
      bottom: 32%;
      width: 3px;
      height: 3px;
      animation-delay: 4.2s;
    }

    &:nth-child(8) {
      left: 14%;
      bottom: 42%;
      width: 3px;
      height: 3px;
      animation-delay: 5.1s;
    }

    &:nth-child(9) {
      left: 44%;
      bottom: 48%;
      width: 5px;
      height: 5px;
      animation-delay: 2.2s;
    }

    &:nth-child(10) {
      left: 70%;
      bottom: 50%;
      width: 4px;
      height: 4px;
      animation-delay: 6.0s;
    }
  }

  &__inner {
    max-width: var(--base-width);
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 40px;
    position: relative;
    z-index: 1;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: fadeSlideUp 0.7s ease-out 0.38s both;
  }

  &__zh {
    font-family: 'cwTeXKai', 'Noto Serif TC', serif;
    font-weight: 900;
    font-size: 80px;
    line-height: 0.9;
    letter-spacing: 0.14em;
    color: var(--gold-bright);
    animation: heroFloat 5s ease-in-out 1.6s infinite;
  }

  &__line {
    width: 80px;
    height: 1.5px;
    background: var(--gold);
    animation: lineExpand 0.9s ease-out 0.7s both;
  }

  &__en {
    font-size: 11px;
    letter-spacing: 0.35em;
    color: var(--paper-3);
  }

  &__tagline {
    font-size: 10px;
    letter-spacing: 0.3em;
    color: var(--paper-2);
    opacity: 0.7;
  }

  &__icons {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(v-bind(heroIconRows), auto);
    column-gap: 28px;
    row-gap: 14px;
  }

  &__icon {
    display: flex;
    gap: 12px;
    align-items: center;
    animation: fadeSlideUp 0.5s ease-out var(--enter-delay, 0.55s) both;
  }

  &__dot {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--gold-bright);
    color: var(--red-deep);
    display: grid;
    place-items: center;
    font-size: 24px;
    border: 2px solid var(--red-deep);
    box-shadow: 0 0 0 2px var(--gold), 0 4px 8px rgba(0, 0, 0, .3);
    flex-shrink: 0;
    animation: dotGlow 3s ease-in-out 2s infinite;
  }

  &__icon-txt {
    display: flex;
    flex-direction: column;

    b {
      font-size: 18px;
      letter-spacing: 0.1em;
      color: var(--gold-bright);
    }

    span {
      font-size: 10px;
      letter-spacing: 0.2em;
      color: var(--paper-3);
    }
  }
}

/* ===== BRUSH DIVIDER ===== */
.brush-div {
  height: 56px;
  background: var(--red);
  border-top: 1px solid rgba(245, 200, 66, 0.3);
  border-bottom: 1px solid rgba(245, 200, 66, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeSlideUp 0.5s ease-out 0.78s both;

  &__inner {
    display: flex;
    align-items: center;
    gap: 16px;

    .brush {
      font-size: 22px;
      color: var(--gold-bright);
      letter-spacing: 0.4em;
    }

    .mono {
      font-size: 11px;
      color: var(--gold);
      letter-spacing: 0.3em;
    }
  }
}

/* ===== GAMES ===== */
.games-band {
  background: var(--paper);
  padding: 60px 36px 80px;
  flex: 1;

  &__head {
    max-width: var(--base-width);
    margin: 0 auto 40px;
    display: grid;
    grid-template-columns: 100px 1fr 200px;
    align-items: end;
    gap: 28px;
    animation: fadeSlideUp 0.55s ease-out 0.9s both;
  }

  &__lt {
    font-size: 30px;
    color: var(--red-deep);
    line-height: 1.15;
    letter-spacing: 0.06em;
    writing-mode: vertical-rl;
    white-space: nowrap;
    height: 180px;
    display: flex;
    align-items: center;
    /* writing-mode 把主軸轉成垂直，align-items 只管到（現在變水平的）交叉軸，
       文字實際的垂直位置要靠 justify-content 才能置中，否則會貼齊頂端 */
    justify-content: center;
  }

  &__ct {
    text-align: center;

    &::before {
      content: '';
      display: block;
      width: 50%;
      height: 2px;
      background: var(--red);
      margin: 0 auto 16px;
    }

    h2 {
      font-size: 72px;
      color: var(--red-deep);
      line-height: 0.9;
      letter-spacing: 0.04em;
      white-space: nowrap;

      .gold {
        color: var(--gold-deep);
      }
    }

    /* 分隔線移到 ct-bottom 自己的 ::before，讓線永遠貼在彩池區塊「上方」，不受它是不是最後一個子元素影響 */
    .games-band__ct-bottom {
      &::before {
        content: '';
        display: block;
        width: 50%;
        height: 2px;
        background: var(--red);
        margin: 16px auto 0;
      }
    }

    /*
     * 全站總彩池：字色比照 .gc__pool-val（同一組金色漸層 + shimmerText）。
     * ⚠️ 這裡跟卡片彩池一樣是米白底（var(--paper)），金色文字直接疊上去對比太弱，
     *    改用 -webkit-text-stroke 在數字字形外描一圈深紅色，文字本身仍是透空漸層。
     */
    .games-pool-band {
      margin-top: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;

      &__label {
        font-size: 11px;
        letter-spacing: 0.3em;
        color: var(--color-red-desc);
        white-space: nowrap;
      }

      &__val {
        font-size: 63px;
        line-height: 1;
        letter-spacing: 0.03em;
        font-variant-numeric: tabular-nums;
        background: linear-gradient(90deg,
            var(--gold-bright) 0%,
            #fffef2 38%,
            var(--gold-bright) 52%,
            var(--gold-bright) 100%);
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        color: transparent;
        -webkit-text-stroke: 1px #de6d4e;
        paint-order: stroke fill;
        animation: shimmerText 3.5s linear infinite;
      }
    }
  }

  &__sub {
    font-size: 11px;
    color: var(--color-red-desc);
    letter-spacing: 0.35em;
    margin-top: 10px;
  }

  &__rt {
    font-size: 11px;
    color: var(--color-red-desc);
    letter-spacing: 0.2em;
    text-align: right;
    line-height: 1.7;
    transform: translateY(30px);
  }
}

.games-grid {
  max-width: var(--base-width);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.gc {
  --gc-accent: var(--red-deep);

  background: var(--ivory);
  border: 1.5px solid var(--gc-accent);
  position: relative;
  padding: 40px 24px 24px;
  overflow: hidden;
  min-height: 340px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  font-family: inherit;
  color: inherit;
  // cursor: pointer;
  animation: fadeSlideUp 0.6s ease-out var(--enter-delay, 1.05s) both;
  transition: transform 0.35s ease, box-shadow 0.35s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 18px 50px rgba(0, 0, 0, .18), 0 0 0 1.5px var(--gc-accent);

    .gc__big-num {
      transform: scale(1.06) rotate(-3deg);
    }
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: repeating-linear-gradient(90deg,
        var(--red) 0 12px,
        var(--gold) 12px 14px,
        var(--red) 14px 26px,
        var(--gold) 26px 28px);
  }

  &--of {
    --gc-accent: var(--red-deep);
  }

  &--cd {
    --gc-accent: var(--red-deep);

    background:
      radial-gradient(ellipse 320px 220px at 88% 8%, rgba(185, 28, 28, 0.12) 0%, transparent 70%),
      var(--ivory);

    &::before {
      background: repeating-linear-gradient(90deg,
          var(--red-deep) 0 12px,
          var(--red-bright) 12px 14px,
          var(--red-deep) 14px 26px,
          var(--red-bright) 26px 28px);
    }

    .gc__big-num {
      color: var(--paper-3);
    }
  }

  &__big-num {
    position: absolute;
    top: 8px;
    right: 14px;
    font-size: 100px;
    line-height: 0.85;
    color: var(--paper-2);
    z-index: 0;
    pointer-events: none;
    user-select: none;
    transform-origin: 80% 20%;
    transition: transform 0.35s ease;
  }

  &__meta {
    font-size: 10px;
    letter-spacing: 0.3em;
    color: var(--gold-deep);
    position: relative;
    z-index: 1;
  }

  &__name {
    font-family: cursive;
    font-size: 48px;
    font-weight: 900;
    line-height: 1;
    color: var(--red-deep);
    margin-top: 8px;
    letter-spacing: 0.1em;
    position: relative;
    z-index: 1;
  }

  &__en {
    font-size: 16px;
    letter-spacing: 0.25em;
    color: #a04030;
    margin-top: 6px;
    position: relative;
    z-index: 1;
  }

  &__tags {
    display: flex;
    align-items: stretch;
    width: 100%;
    margin-top: 14px;
    position: relative;
    z-index: 1;
  }

  &__ribbon {
    flex: 1;
    padding: 4px 10px;
    background: var(--red);
    color: var(--paper);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-align: left;
  }

  &__desc {
    font-size: 12px;
    line-height: 1.75;
    color: #5a2a1f;
    margin-top: 12px;
    letter-spacing: 0.04em;
    position: relative;
    z-index: 1;
    flex: 1;
    white-space: pre-line;
  }

  &__note {
    font-size: 10px;
    letter-spacing: 0.2em;
    color: var(--color-red-desc);
    margin-top: 10px;
    position: relative;
    z-index: 1;
  }

  /*
   * 彩池／爆池總額：字色比照 .hall-top__title 的金色跑馬燈效果（同一組漸層 + shimmerText）。
   * ⚠️ 卡片底色是米白（var(--ivory) = #fff9e8），金色文字直接疊上去對比太弱、幾乎看不清楚，
   *    不加框線 DOM、不上底色，改用 -webkit-text-stroke 直接在數字「字形本身」外面描一圈
   *    深紅色，文字還是透空的漸層填色，只是每個字多一個描邊。
   */
  &__pool {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    position: relative;
    z-index: 1;
  }

  &__pool-label {
    font-size: 9px;
    letter-spacing: 0.22em;
    color: var(--color-red-desc);
  }

  &__pool-val {
    font-size: 52px;
    line-height: 1;
    letter-spacing: 0.03em;
    font-variant-numeric: tabular-nums;
    background: linear-gradient(90deg,
        var(--gold-bright) 0%,
        #fffef2 38%,
        var(--gold-bright) 52%,
        var(--gold-bright) 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
    -webkit-text-stroke: 1px #de6d4e;
    paint-order: stroke fill;
    animation: shimmerText 3.5s linear infinite;
  }

  &__enter {
    --gc-shine: rgba(255, 255, 255, .28);

    margin-top: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 10px;
    border: 1.5px solid var(--gc-accent);
    transition: background 0.22s, color 0.22s;
    position: relative;
    overflow: hidden;
    z-index: 1;
    /* 入場鈕是唯一綁 click 的元素（卡片本體不再導頁），指標樣式掛在它身上；
       不寫在 .gc--of 的 &:hover 底下，否則只有官方卡有、且滑到卡片其他區域也會變手指 */
    cursor: pointer;

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: -80%;
      width: 50%;
      height: 100%;
      background: linear-gradient(90deg, transparent, var(--gc-shine), transparent);
      animation: cdShimmer 3.2s ease-in-out 2.5s infinite;
      pointer-events: none;
    }
  }

  &__enter-label {
    font-size: 22px;
    letter-spacing: 0.12em;
    line-height: 1;
    position: relative;
    z-index: 1;
  }

  &__enter-tag {
    font-size: 9px;
    letter-spacing: 0.2em;
    margin-top: 4px;
    position: relative;
    z-index: 1;
  }

  &--of {
    .gc__enter {
      color: var(--red-deep);
      background: transparent;

      /* 米白底上白色漸層看不出來，改成純色白光帶掃過 */
      &::after {
        width: 20%;
        background: rgba(255, 255, 255, 0.9);
      }

    }

    &:hover .gc__enter {
      background: var(--red-deep);
      color: var(--paper);

      &::after {
        background: rgba(255, 255, 255, .22);
      }

      .gc__enter-tag {
        color: var(--paper-3);
      }
    }
  }

  &--cd {
    .gc__enter {
      border-color: var(--gold-deep);
      color: var(--red-ink);
      background: var(--gold);
    }

    .gc__enter-tag {
      color: #8a4a3a;
    }

    &:hover .gc__enter {
      background: var(--gold-bright);
    }
  }
}

/* ===== TICKER ===== */
.ticker {
  background: var(--red-deep);
  border-top: 2px solid var(--gold);
  border-bottom: 2px solid var(--gold);
  padding: 14px 36px;
  display: flex;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--paper-2);
  letter-spacing: 0.15em;
  overflow: hidden;
  animation: fadeIn 0.5s ease-out 1.5s both;

  &__lbl {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 16px;
    letter-spacing: 0.25em;
    color: var(--gold-bright);
    flex-shrink: 0;
    margin-right: 24px;
  }

  &__band {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
    mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
  }

  &__track {
    display: flex;
    align-items: center;
    gap: 24px;
    width: max-content;
    white-space: nowrap;
    animation: tickerScroll 24s linear infinite;
  }

  &__div {
    color: var(--gold);
  }
}

/* ===== FOOTER ===== */
.hall-foot {
  background: var(--red-ink);
  color: var(--paper-3);
  padding: 20px 36px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.25em;
  border-top: 1px solid var(--gold);
  animation: fadeIn 0.5s ease-out 1.6s both;

  &__copy {
    color: var(--gold);
  }
}
</style>
