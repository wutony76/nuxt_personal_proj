<script setup lang="ts">
import { computed } from 'vue'
import DialogShell from '~/components/lottery/bg/fc3d/block/DialogShell.vue'
import {
  FC3D_TOTAL_OUTCOMES, FC3D_SUM_MIN, FC3D_SUM_MAX, FC3D_SUM_BIG_LINE,
  fc3dSumCounts, fc3dGroupSumCounts
} from '#shared/config/fc3d'
import { fc3dGroupCombos, FC3D_OF_PRIZE_TIERS } from '#shared/config/fc3d-of'
import {
  fc3dPlays, fc3dRtpOf, fc3dTabOddsOf, fc3dComboGroups, fc3dOfIsPoolTab, type Fc3dOfGroupMode
} from '#shared/config/fc3dof/helpers'

/**
 * 玩法說明
 *
 * 賠率與機率一律由 config / fc3d-of.ts 推算，改設定就自動跟上（不寫死數字）。
 * 直選組選／組選類多位置玩法只挑一組「代表性注碼」示範（同一分頁內任何合法組合的賠率都相同），
 * 和值類則逐值列出（各和值的機率不同，逐值才有意義）；三星直選已改吃分層彩池，改顯示分層表格。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const NAV_ITEMS = [
  { id: 'fc3d-section-intro', label: '遊戲簡介' },
  { id: 'fc3d-section-timeline', label: '時間流程' },
  { id: 'fc3d-section-sum', label: '直選和值分布' },
  { id: 'fc3d-section-group-sum', label: '組選和值分布' },
  { id: 'fc3d-section-play', label: '投注玩法' },
  { id: 'fc3d-section-note', label: '特別說明' }
]

/** 每期 3 分鐘（福彩3D期表比 eggs/6hc 短，實際以伺端 status timer 為準，此處僅供說明參考） */
const TIMELINE = [
  { range: '開盤中', status: '開盤中', desc: '可投注區間' },
  { range: '封盤前 5 秒', status: '準備封盤', desc: '倒數封盤，逾時不候' },
  { range: '封盤後', status: '已封盤', desc: '停止接受投注' },
  { range: '開獎中', status: '正在開獎中', desc: '開出 3 個號碼（百/十/個位，各 0~9）' },
  { range: '開獎後', status: '已開獎', desc: '逐注結算派彩，可查閱結果' }
]

const click = {
  scrollTo: (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/** 每個分頁挑一組「代表性注碼」示範賠率（同分頁內任何合法組合賠率都相同，除了和值類） */
function _sampleRows(playKey: string, tab: any): Array<{ name: string; odds: number }> {
  const combo = tab.combo
  if (!combo) {
    return (tab.tabGroup ?? []).flatMap((group: any) => (group.groupList ?? []).map((item: any) => ({
      name: String(item.name),
      odds: fc3dTabOddsOf(playKey, tab.tabId, String(item.name))
    })))
  }
  const groups = fc3dComboGroups(playKey, tab.tabId)
  if (combo.mode === 'input') {
    const code = `${combo.prefix}000`
    return [{ name: '任意 3 位數字（單式輸入）', odds: fc3dTabOddsOf(playKey, tab.tabId, code) }]
  }
  if (combo.mode === 'each') {
    const values = groups[0]?.values ?? []
    return values.map((value) => {
      const code = `${combo.prefix}${value}`
      return { name: `${combo.prefix}${value}`, odds: fc3dTabOddsOf(playKey, tab.tabId, code) }
    })
  }
  if (combo.mode === 'group') {
    const pool = groups[0]?.values ?? []
    const sample = fc3dGroupCombos(pool, combo.group as Fc3dOfGroupMode)[0]
    if (!sample) return []
    const code = `${combo.prefix}${sample.join('')}`
    return [{ name: `${combo.prefix}${sample.join('')}（示範，任一合法組合賠率相同）`, odds: fc3dTabOddsOf(playKey, tab.tabId, code) }]
  }
  // direct / sides：每個位置各取第一個選項組出一組代表性注碼
  const picks = groups.map((group) => (group.sides.length > 0 ? group.sides[0] : String(group.values[0] ?? '')))
  const code = `${combo.prefix}${picks.join('')}`
  return [{ name: `${combo.prefix}${picks.join('')}（示範，任一合法組合賠率相同）`, odds: fc3dTabOddsOf(playKey, tab.tabId, code) }]
}

const PLAY_ROWS = computed(() =>
  (fc3dPlays() as any[]).map((play) => ({
    key: play.key,
    name: play.name,
    tabs: (play.list ?? []).map((tab: any) => ({
      tabName: tab.tabName,
      rtp: fc3dRtpOf(play.key, tab.tabId),
      isPool: fc3dOfIsPoolTab(play.key, tab.tabId),
      rows: _sampleRows(play.key, tab)
    }))
  }))
)

/** 三星直選分層彩池摘要（供「投注玩法」段落取代固定賠率顯示） */
const poolTierRows = FC3D_OF_PRIZE_TIERS.map((tier) => ({
  name: tier.name,
  match: tier.match,
  desc: tier.type === 'pool'
    ? `彩池 × ${(tier.ratio * 100).toFixed(0)}%（按下注額比例分）${tier.minAmount ? `，每單位保底 ${tier.minAmount.toLocaleString('zh-TW')}` : ''}`
    : `固定 ${tier.amount} 倍下注額`
}))

const sumRows = computed(() => {
  const table = fc3dSumCounts()
  return Object.keys(table).map(Number).sort((a, b) => a - b).map((sum) => ({
    sum,
    count: table[sum],
    percent: ((table[sum]! / FC3D_TOTAL_OUTCOMES) * 100).toFixed(4)
  }))
})
const groupSumRows = computed(() => {
  const table = fc3dGroupSumCounts()
  return Object.keys(table).map(Number).sort((a, b) => a - b).map((sum) => ({
    sum,
    count: table[sum],
    percent: ((table[sum]! / FC3D_TOTAL_OUTCOMES) * 100).toFixed(4)
  }))
})
</script>

<template>
  <DialogShell :visible="props.visible" title="遊戲說明 — 福彩3D官方玩法" width="min(1100px, 96vw)" @close="emit('close')">
    <nav class="rule-nav">
      <button v-for="item in NAV_ITEMS" :key="item.id" type="button" class="rule-nav-btn"
        @click="click.scrollTo(item.id)">
        {{ item.label }}
      </button>
    </nav>

    <section id="fc3d-section-intro" class="rule-sec">
      <h4>遊戲簡介</h4>
      <ul>
        <li>每期開出 <strong>3 個號碼</strong>（百/十/個位，各 0 ~ 9，可重複），
          共 10³ = <strong>{{ FC3D_TOTAL_OUTCOMES }}</strong> 種等機率結果，全部可窮舉、機率是精確值。</li>
        <li>福彩3D<strong>只有官方玩法</strong>，沒有信用玩法 —— 每注獨立、按賠率派彩。</li>
        <li>賠率一律由「公平賠率 × 回報率」推算（公平賠率 = 母數 ÷ 該注項命中的結果數），
          不是拍板數字，因此每個注項的期望回報率一致。</li>
      </ul>
    </section>

    <section id="fc3d-section-timeline" class="rule-sec">
      <h4>時間流程</h4>
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

    <section id="fc3d-section-sum" class="rule-sec">
      <h4>三星直選和值分布（{{ FC3D_TOTAL_OUTCOMES }} 種結果窮舉，和值範圍 {{ FC3D_SUM_MIN }} ~ {{ FC3D_SUM_MAX }}）</h4>
      <table class="rule-table wide-table">
        <thead><tr><th>和值</th><th v-for="row in sumRows" :key="row.sum">{{ row.sum }}</th></tr></thead>
        <tbody>
          <tr><td>組數</td><td v-for="row in sumRows" :key="row.sum">{{ row.count }}</td></tr>
          <tr><td>機率%</td><td v-for="row in sumRows" :key="row.sum">{{ row.percent }}</td></tr>
        </tbody>
      </table>
      <p class="rule-note">※ 大小分界（純顯示用）：和值 &gt; {{ FC3D_SUM_BIG_LINE }} 為大、≤ {{ FC3D_SUM_BIG_LINE }} 為小。</p>
    </section>

    <section id="fc3d-section-group-sum" class="rule-sec">
      <h4>三星組選和值分布（排除豹子，和值範圍 1 ~ 26）</h4>
      <table class="rule-table wide-table">
        <thead><tr><th>和值</th><th v-for="row in groupSumRows" :key="row.sum">{{ row.sum }}</th></tr></thead>
        <tbody>
          <tr><td>命中排列數</td><td v-for="row in groupSumRows" :key="row.sum">{{ row.count }}</td></tr>
          <tr><td>機率%</td><td v-for="row in groupSumRows" :key="row.sum">{{ row.percent }}</td></tr>
        </tbody>
      </table>
      <p class="rule-note">※ 豹子（3 位數字皆相同）不計入任何組選和值，母數仍是全部 {{ FC3D_TOTAL_OUTCOMES }} 種開獎結果。</p>
    </section>

    <h3 id="fc3d-section-play" class="rule-group-title">投注玩法 · 福彩3D官方玩法</h3>
    <section v-for="play in PLAY_ROWS" :key="play.key" class="rule-sec">
      <h4>{{ play.name }}</h4>
      <div v-for="tab in play.tabs" :key="tab.tabName">
        <p class="rule-note">
          {{ tab.tabName }} ·
          <template v-if="tab.isPool">浮動賠率（依彩池分潤，見下方分層說明）</template>
          <template v-else>回報率 {{ (tab.rtp * 100).toFixed(0) }}%</template>
        </p>
        <table v-if="!tab.isPool" class="rule-table">
          <thead>
            <tr><th>注碼</th><th>賠率</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in tab.rows" :key="row.name">
              <td class="is-name">{{ row.name }}</td>
              <td class="is-odds">{{ row.odds }}</td>
            </tr>
          </tbody>
        </table>
        <table v-else class="rule-table">
          <thead>
            <tr><th>命中位數</th><th>分層</th><th>派彩方式</th></tr>
          </thead>
          <tbody>
            <tr v-for="tier in poolTierRows" :key="tier.match">
              <td class="is-name">{{ tier.match }} 位</td>
              <td class="is-name">{{ tier.name }}</td>
              <td class="is-odds">{{ tier.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="fc3d-section-note" class="rule-sec">
      <h4>特別說明</h4>
      <ul>
        <li><strong>豹子</strong>：3 位數字皆相同（如 111）；豹子不計入任何三星組選類玩法（組三／組六／組選和值）。</li>
        <li><strong>不定位</strong>：一碼不定位判定所選數字是否出現在三位數字中任一位；
          二碼不定位判定所選兩個相異數字是否各自出現在三位數字中（不要求對應位置）。</li>
        <li>三星組選和值目前只提供合併版（不分「組三和值」與「組六和值」）。</li>
        <li><strong>三星直選（複式／單式）已改吃分層彩池</strong>：依命中位數（0~3 位）分層派彩，
          未中獎的分層獎金整塊滾存至下期；判定方式為逐位比對，與百/十/個位置對應是否相同無關順序。</li>
        <li><strong>全站爆池</strong>：任一分頁下注都會抽水累積，開出<strong>豹子</strong>（三位數字全同）時觸發，
          依「下注額 × 該注項權重」比例分配給該期有份的注單（含三星直選）。</li>
        <li><strong>固定賠率的分頁</strong>在下注當下就鎖進注單，之後調整設定或回報率都不影響已成立的注單；
          三星直選的實際派彩則以開獎後的分層結果為準。</li>
        <li>單注與單期限額由各分頁的設定決定，超限伺端會<strong>整筆拒單</strong>（不會只擋超出的部分）。</li>
      </ul>
    </section>
  </DialogShell>
</template>

<style scoped lang="scss">
/* 版面與 eggs 的遊戲說明同一套：每段落一張帶框的區塊卡片、紅底表頭的表格 */
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

  &#fc3d-section-intro {
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

.wide-table th,
.wide-table td {
  width: auto;
}

#fc3d-section-sum .rule-table,
#fc3d-section-group-sum .rule-table {
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

  &.status-已封盤,
  &.status-準備封盤 {
    background: #f3f4f6;
    color: #6b7280;
  }
}
</style>
