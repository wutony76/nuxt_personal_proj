<script setup lang="ts">
import { computed } from 'vue'
import DialogShell from '~/components/lottery/bg/eggs/block/DialogShell.vue'
import {
  eggsOddsOf,
  EGGS_BIG_LINE,
  EGGS_SUM_MAX,
  EGGS_SUM_MIN,
  EGGS_TOTAL_OUTCOMES
} from '#shared/config/eggs-cd'
import { EGGS_SUM_COUNTS, EGGS_EXTREME_BIG_RANGE, EGGS_EXTREME_SMALL_RANGE } from '#shared/config/eggs'
import { EGGS_JACKPOT_SETTINGS } from '#shared/config/eggs-cd'
import C_PLAYS from '#shared/config/eggscd/plays'
import { eggsRtpOf, eggsTabOddsOf } from '#shared/config/eggscd/helpers'

/**
 * 玩法說明
 * 賠率與機率一律由 config / eggs-cd 推算，改設定就自動跟上（不寫死數字）
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

/**
 * 爆池說明的數字一律讀 EGGS_JACKPOT_SETTINGS，不寫死 ——
 * 之後調整觸發條件、發放比例或門檻，說明頁自動跟上
 */
const JACKPOT = EGGS_JACKPOT_SETTINGS
const jackpotHitRate = `${(JACKPOT.hitRate * 100).toFixed(2)}%`
const jackpotPayoutPct = `${(JACKPOT.payoutRatio * 100).toFixed(0)}%`
const jackpotRakePct = `${(JACKPOT.rakeRatio * 100).toFixed(0)}%`

/** 各分頁的爆池權重（讀看板設定，與實際分配用的是同一份資料） */
const JACKPOT_WEIGHTS = C_PLAYS.map((play) => {
  const tab = play.list?.[0]
  const items = (tab?.tabGroup ?? []).flatMap((group) => group.groupList ?? [])
  const levels = Array.from(new Set(items.map((item) => Number((item as { weight?: number }).weight ?? 0))))
    .sort((a, b) => b - a)
  return { name: String(play.name ?? ''), tabName: String(tab?.tabName ?? ''), levels }
})

const NAV_ITEMS = [
  { id: 'eggs-section-intro', label: '遊戲簡介' },
  { id: 'eggs-section-timeline', label: '時間流程' },
  { id: 'eggs-section-sum', label: '和值分布' },
  { id: 'eggs-section-play', label: '投注玩法' },
  { id: 'eggs-section-jackpot', label: '爆池' },
  { id: 'eggs-section-note', label: '特別說明' }
]

/** 每期 7 分鐘（與 6hc / k3 共用 server game/lottery/bg/base.ts 的 timer.getStatusBySeconds） */
const TIMELINE = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒 — 5 分 50 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒 — 6 分 00 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒 — 6 分 40 秒', status: '正在開獎中', desc: '開出 3 顆號碼球（0~9）' },
  { range: '6 分 40 秒 後', status: '已開獎', desc: '逐注結算派彩，可查閱結果' }
]

const click = {
  scrollTo: (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/** 各玩法的注項表（含命中機率，由公平賠率反推：機率 = 1 / 公平賠率） */
const PLAY_ROWS = computed(() =>
  (C_PLAYS as any[]).map((play) => ({
    key: play.key,
    name: play.name,
    tabs: play.list.map((tab: any) => ({
      tabName: tab.tabName,
      rtp: eggsRtpOf(play.key, tab.tabId),
      groups: tab.tabGroup.map((group: any) => ({
        groupName: group.groupName,
        items: group.groupList.map((item: any) => {
          const odds = eggsTabOddsOf(play.key, tab.tabId, String(item.name))
          const fair = eggsOddsOf(String(item.name), 1)
          return {
            name: String(item.name),
            odds,
            percent: fair > 0 ? (100 / fair).toFixed(4) : '—'
          }
        })
      }))
    }))
  }))
)

const sumRows = computed(() =>
  Object.keys(EGGS_SUM_COUNTS).map(Number).sort((a, b) => a - b).map((sum) => ({
    sum,
    count: EGGS_SUM_COUNTS[sum],
    percent: ((EGGS_SUM_COUNTS[sum]! / EGGS_TOTAL_OUTCOMES) * 100).toFixed(4)
  }))
)
</script>

<template>
  <DialogShell :visible="props.visible" title="遊戲說明 — PC蛋蛋信用玩法" width="min(1100px, 96vw)" @close="emit('close')">
    <nav class="rule-nav">
      <button v-for="item in NAV_ITEMS" :key="item.id" type="button" class="rule-nav-btn"
        @click="click.scrollTo(item.id)">
        {{ item.label }}
      </button>
    </nav>

    <section id="eggs-section-intro" class="rule-sec">
      <h4>遊戲簡介</h4>
      <ul>
        <li>每期開出 <strong>3 顆號碼球</strong>，每顆 0 ~ 9 點（可重複），
          共 10³ = <strong>{{ EGGS_TOTAL_OUTCOMES }}</strong> 種等機率結果，全部可窮舉、機率是精確值。</li>
        <li>PC蛋蛋<strong>只有信用玩法</strong>，沒有官方玩法／共用彩池 —— 每注獨立、按賠率派彩。</li>
        <li>賠率一律由「公平賠率 × 回報率」推算（公平賠率 = {{ EGGS_TOTAL_OUTCOMES }} ÷ 該注項命中的結果數），
          不是拍板數字，因此每個注項的期望回報率一致。</li>
      </ul>
    </section>

    <section id="eggs-section-timeline" class="rule-sec">
      <h4>時間流程（每期共 7 分鐘）</h4>
      <table class="rule-table">
        <thead><tr><th>時間</th><th>狀態</th><th>說明</th></tr></thead>
        <tbody>
          <tr v-for="row in TIMELINE" :key="row.range">
            <td class="td-range">{{ row.range }}</td>
            <td><span class="status-badge" :class="`status-${row.status}`">{{ row.status }}</span></td>
            <td>{{ row.desc }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="eggs-section-sum" class="rule-sec">
      <h4>和值分布（{{ EGGS_TOTAL_OUTCOMES }} 種結果窮舉，和值範圍 {{ EGGS_SUM_MIN }} ~ {{ EGGS_SUM_MAX }}）</h4>
      <table class="rule-table wide-table">
        <thead><tr><th>和值</th><th v-for="row in sumRows" :key="row.sum">{{ row.sum }}</th></tr></thead>
        <tbody>
          <tr><td>組數</td><td v-for="row in sumRows" :key="row.sum">{{ row.count }}</td></tr>
          <tr><td>機率%</td><td v-for="row in sumRows" :key="row.sum">{{ row.percent }}</td></tr>
        </tbody>
      </table>
      <p class="rule-note">
        ※ 大小分界：和值 &gt; {{ EGGS_BIG_LINE }} 為大、≤ {{ EGGS_BIG_LINE }} 為小；
        極大／極小分別對應和值 {{ EGGS_EXTREME_BIG_RANGE[0] }}~{{ EGGS_EXTREME_BIG_RANGE[1] }}
        與 {{ EGGS_EXTREME_SMALL_RANGE[0] }}~{{ EGGS_EXTREME_SMALL_RANGE[1] }}。
      </p>
    </section>

    <h3 id="eggs-section-play" class="rule-group-title">投注玩法 · PC蛋蛋信用玩法（賠率制）</h3>
    <section v-for="play in PLAY_ROWS" :key="play.key" class="rule-sec">
      <h4>{{ play.name }}</h4>
      <div v-for="tab in play.tabs" :key="tab.tabName">
        <p class="rule-note">回報率 {{ (tab.rtp * 100).toFixed(0) }}%</p>
        <table v-for="group in tab.groups" :key="group.groupName" class="rule-table">
          <thead>
            <tr><th>{{ group.groupName }}</th><th>賠率</th><th>命中機率%</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in group.items" :key="item.name">
              <td class="is-name">{{ item.name }}</td>
              <td class="is-odds">{{ item.odds }}</td>
              <td>{{ item.percent }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="eggs-section-jackpot" class="rule-sec">
      <h4>爆池</h4>
      <ul>
        <li>每筆投注額的 <strong>{{ jackpotRakePct }}</strong> 撥入爆池累積，
          與賠率派彩<strong>互不影響</strong>（賠率派彩由莊家支付，不吃這個池）。</li>
        <li>開獎<strong>{{ JACKPOT.hitLabel }}</strong>（機率 {{ jackpotHitRate }}）時觸發，
          一次發放累積池的 <strong>{{ jackpotPayoutPct }}</strong>，其餘滾存至下期。</li>
        <li>累積池未達 <strong>{{ money(JACKPOT.minPool) }}</strong> 時不發放，整池滾存。</li>
        <li>有份的是該期<strong>非未中</strong>的注單（和局也算有份），
          依「<strong>投注額 × 注項權重</strong>」比例分配。</li>
      </ul>
      <div class="rule-table-wrap">
        <table class="rule-table">
          <thead>
            <tr><th>玩法</th><th>分頁</th><th>注項權重</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in JACKPOT_WEIGHTS" :key="row.name">
              <td>{{ row.name }}</td>
              <td>{{ row.tabName }}</td>
              <td>{{ row.levels.join('／') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="rule-note">
        權重依「理論賠率（母數 ÷ 命中數）」分三級：≥ 20 倍 → 3、2.5 ~ 20 倍 → 2、&lt; 2.5 倍 → 1。
        越難中的注項在爆池分到越多。
      </p>
    </section>

    <section id="eggs-section-note" class="rule-sec">
      <h4>特別說明</h4>
      <ul>
        <li><strong>豹子</strong>：3 顆球點數皆相同；<strong>對子</strong>：恰有 2 顆相同；
          <strong>順子</strong>：3 顆互不相同且可排成連號（跨 9→0 不算，例如 8、9、0 不算順子）。</li>
        <li><strong>極大／極小</strong>：和值分別落在
          {{ EGGS_EXTREME_BIG_RANGE[0] }}~{{ EGGS_EXTREME_BIG_RANGE[1] }} 與
          {{ EGGS_EXTREME_SMALL_RANGE[0] }}~{{ EGGS_EXTREME_SMALL_RANGE[1] }} 之間即中。</li>
        <li><strong>特碼</strong>：直接猜中和值（{{ EGGS_SUM_MIN }} ~ {{ EGGS_SUM_MAX }}）。</li>
        <li><strong>賠率在下注當下就鎖進注單</strong>，之後調整設定或回報率都不影響已成立的注單。</li>
        <li>單注與單期限額由各分頁的設定決定，超限伺端會<strong>整筆拒單</strong>（不會只擋超出的部分）。</li>
        <li><strong>爆池加碼</strong>與賠率派彩會合併在同一期的可領獎金裡，
          下注紀錄的派彩欄會另外標出加碼金額。</li>
      </ul>
    </section>
  </DialogShell>
</template>

<style scoped lang="scss">
/* 版面與 k3 的遊戲說明同一套：每段落一張帶框的區塊卡片、紅底表頭的表格 */
.rule-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border: 1px solid #fee2e2;
  border-bottom: unset;
  border-radius: 6px 6px 0 0;
  background: #fff5f6;
  padding: 8px 10px;

  .rule-nav-btn {
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

.rule-group-title {
  margin: 18px 0 10px;
  font-size: 14px;
  font-weight: 800;
  color: var(--color-red-main);
}

.rule-sec {
  margin-bottom: 14px;
  border: 1px solid #fee2e2;
  border-radius: 6px;
  padding: 12px 14px;

  &#eggs-section-intro {
    border-radius: 0 0 6px 6px;
  }

  &:last-of-type {
    margin-bottom: 4px;
  }

  h4 {
    margin: 0 0 10px;
    border-left: 3px solid var(--color-red-main);
    padding-left: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main);
  }

  ul {
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
  }

  ul + .rule-table,
  ul + p {
    margin-top: 10px;
  }

  .rule-note {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--color-red-desc);
  }
}

.rule-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-bottom: 8px;
  font-size: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  th,
  td {
    width: calc(100% / 3);
    padding: 6px 8px;
    text-align: center;
  }

  thead th {
    background: var(--color-red-main);
    color: #fff;
    font-weight: 600;
    white-space: nowrap;
  }

  tbody td {
    border-bottom: 1px solid #fee2e2;
    color: #374151;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover td {
    background: #fff5f6;
  }

  .is-name {
    font-weight: 700;
    color: var(--color-red-main);
  }

  .is-odds {
    font-weight: 700;
    color: #d97706;
  }
}

/* 和值分布是 28 欄的寬表，不能均分（會擠爆），改水平捲動 */
.wide-table th,
.wide-table td {
  width: auto;
}

#eggs-section-sum .rule-table {
  overflow-x: auto;
  display: block;
}

.td-range {
  white-space: nowrap;
  font-weight: 600;
  color: var(--color-red-desc);
  font-variant-numeric: tabular-nums;
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
</style>
