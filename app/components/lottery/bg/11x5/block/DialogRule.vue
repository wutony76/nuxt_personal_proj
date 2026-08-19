<script setup lang="ts">
import { computed } from 'vue'
import DialogShell from '~/components/lottery/bg/11x5/block/DialogShell.vue'
import {
  x5ComboHits,
  x5SumOf,
  X5_BALL_COUNT,
  X5_BIG_LINE,
  X5_NUMBERS,
  X5_NUMBER_MAX,
  X5_NUMBER_MIN,
  X5_SUM_BIG_LINE,
  X5_SUM_MAX,
  X5_SUM_MIN,
  X5_SUM_TAIL_BIG_LINE,
  X5_TOTAL_COMBOS,
  X5_TOTAL_PERMS
} from '#shared/config/x5'
import C_PLAYS from '#shared/config/x5cd/plays'
import { x5RtpOf, x5TabOddsOf } from '#shared/config/x5cd/helpers'
import { useX5 } from '~/composables/useX5'

/**
 * 玩法說明
 *
 * 注項表、賠率、機率一律由 config + x5 的機率層推算 —— 改設定就自動跟上，不寫死數字。
 * 這也是「UI 依 config 顯示」的一部分：新增一個分頁或注項，說明頁會自己長出來。
 *
 * ⚠️ 階段 1 只有信用盤（4 分頁、固定賠率）。階段 2 接上官方盤後，
 *    比照 ssc 的 DialogRule.vue 補 ogPlayTables 與 isCd 分流的「投注玩法」段落。
 * ⚠️ 爆池那段的數字（條件文案、機率、發放比例、門檻）全部讀 creditJackpot 這份
 *    伺端狀態，不寫死文案 —— 改 X5_JACKPOT_SETTINGS 說明頁會自己跟上。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { creditJackpot: mxJackpot } = useX5()
const boardName = '信用'

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

/** 上方快捷選單 */
const NAV_ITEMS = [
  { id: 'x5-section-intro', label: '遊戲簡介' },
  { id: 'x5-section-timeline', label: '時間流程' },
  { id: 'x5-section-play', label: '投注玩法' },
  { id: 'x5-section-prize', label: '獎金結構' },
  { id: 'x5-section-note', label: '特別說明' }
]

/** 每期 7 分鐘（與 6hc / k3 / pk10 / ssc 共用 server game/lottery/bg/base.ts 的 timer.getStatusBySeconds） */
const TIMELINE = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒 — 5 分 50 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒 — 6 分 00 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒 — 6 分 40 秒', status: '正在開獎中', desc: `開出 ${X5_BALL_COUNT} 個不重複號碼` },
  { range: '6 分 40 秒 後', status: '已開獎', desc: '逐注結算派彩，可查閱結果' }
]

/**
 * 總和各組面的命中數（母數 C(11,5) = 462，全部窮舉）
 *
 * ⚠️ 這些數字要真的算，不能寫死或用「對半」帶過 ——
 *    11選5 的總和分佈對稱於 30 而大小界線切在 30/31，所以大小**不對稱**（215 / 247）。
 */
const sumStats = computed(() => ({
  big: x5ComboHits((combo) => x5SumOf(combo) >= X5_SUM_BIG_LINE),
  small: x5ComboHits((combo) => x5SumOf(combo) < X5_SUM_BIG_LINE),
  tailBig: x5ComboHits((combo) => x5SumOf(combo) % 10 >= X5_SUM_TAIL_BIG_LINE),
  tailSmall: x5ComboHits((combo) => x5SumOf(combo) % 10 < X5_SUM_TAIL_BIG_LINE)
}))

/** 單球大小的號碼數（大 7~11 共 5 個、小 1~6 共 6 個 —— 11 個號碼切在 6/7 本來就不對稱） */
const ballSideStats = computed(() => ({
  big: X5_NUMBERS.filter((num) => num >= X5_BIG_LINE).length,
  small: X5_NUMBERS.filter((num) => num < X5_BIG_LINE).length,
  odd: X5_NUMBERS.filter((num) => num % 2 === 1).length,
  even: X5_NUMBERS.filter((num) => num % 2 === 0).length
}))

/** 爆池條件的命中組合數（供說明頁列出「7 / 462」而不只是百分比） */
const jackpotHits = computed(() => Math.round(Number(mxJackpot.hitRate ?? 0) * X5_TOTAL_COMBOS))
const jackpotHitRate = computed(() => `${(Number(mxJackpot.hitRate ?? 0) * 100).toFixed(4)}%`)
const jackpotReady = computed(() => Number(mxJackpot.rakeRatio) > 0)

/**
 * 信用盤的注項表：依「玩法 → 分頁 → 群組 → 注項」攤平
 *
 * 賠率用 helpers 依該分頁 rtp 即時推算（與看板、伺端派彩同一支）。
 * 1-5球 每個群組有 11 個注項，用「群組名 + 一整排注項/賠率」的緊湊版面，不逐項起一列。
 */
const cdPlayTables = computed(() =>
  (C_PLAYS as any[]).map((play) => ({
    key: String(play.key ?? ''),
    name: String(play.name ?? ''),
    tabs: (play.list ?? []).map((tab: any) => {
      const tabId = Number(tab.tabId)
      return {
        tabId,
        tabName: String(tab.tabName ?? ''),
        rtp: `${(x5RtpOf(play.key, tabId) * 100).toFixed(0)}%`,
        groups: (tab.tabGroup ?? []).map((group: any) => ({
          groupName: String(group.groupName ?? ''),
          items: (group.groupList ?? []).map((item: any) => ({
            name: String(item.name ?? ''),
            odds: x5TabOddsOf(play.key, tabId, String(item.name))
          })).filter((item: { odds: number }) => item.odds > 0)
        })).filter((group: { items: unknown[] }) => group.items.length > 0)
      }
    })
  }))
)

const click = {
  /** 快捷選單：捲到對應段落（scrollIntoView 會自己找捲動容器，不用接 DialogShell 的 ref） */
  scrollTo: (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <DialogShell :visible="props.visible" :title="`遊戲說明 — 11選5 ${boardName}玩法`" width="min(1100px, 96vw)"
    @close="emit('close')">
    <!-- 上方快捷選單 -->
    <nav class="rule-nav">
      <button v-for="item in NAV_ITEMS" :key="item.id" type="button" class="rule-nav-btn"
        @click="click.scrollTo(item.id)">
        {{ item.label }}
      </button>
    </nav>

    <section id="x5-section-intro" class="rule-sec">
      <h4>遊戲簡介</h4>
      <ul>
        <li>每期從 {{ X5_NUMBER_MIN }} ~ {{ X5_NUMBER_MAX }} 開出 <strong>{{ X5_BALL_COUNT }} 個不重複號碼</strong>，
          並且有位置（第一 ~ 第五球）。號碼<strong>不會重複</strong>（與時時彩不同）。</li>
        <li>因此同一個彩種有<strong>兩種母數</strong>：看「號碼集合」的玩法（總和、全5中1）母數是
          C({{ X5_NUMBER_MAX }},{{ X5_BALL_COUNT }}) = <strong>{{ X5_TOTAL_COMBOS.toLocaleString('zh-TW') }}</strong> 種組合；
          看「位置」的玩法母數是 P({{ X5_NUMBER_MAX }},{{ X5_BALL_COUNT }}) =
          <strong>{{ X5_TOTAL_PERMS.toLocaleString('zh-TW') }}</strong> 種排列。
          單球類（某球位開某號碼／大小單雙）因為每個球位落在每個號碼的機率都相同，直接用母數 {{ X5_NUMBER_MAX }}。</li>
        <li>目前檢視的是 <strong>11選5 {{ boardName }}玩法</strong>，共 1-5球／兩面／龍虎鬥／全5中1 四個分頁。</li>
        <li>賠率一律由「公平賠率 × 回報率」推算，不是拍板數字：公平賠率 = 該注項的母數 ÷ 命中數。</li>
      </ul>
    </section>

    <section id="x5-section-timeline" class="rule-sec">
      <h4>時間流程（每期共 7 分鐘）</h4>
      <table class="rule-table">
        <thead>
          <tr><th>時間</th><th>狀態</th><th>說明</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in TIMELINE" :key="row.range">
            <td class="td-range">{{ row.range }}</td>
            <td><span class="status-badge" :class="`status-${row.status}`">{{ row.status }}</span></td>
            <td>{{ row.desc }}</td>
          </tr>
        </tbody>
      </table>
      <p class="rule-note">※ 期表與開獎號由伺端共用層持有，同一期的時間點與號碼對所有盤口都一致。</p>
    </section>

    <h3 id="x5-section-play" class="rule-group-title">投注玩法 · 11選5 {{ boardName }}玩法（固定賠率）</h3>

    <section v-for="play in cdPlayTables" :key="play.key" class="rule-block">
      <div v-for="tab in play.tabs" :key="`${play.key}-${tab.tabId}`">
        <p class="rule-group-title">
          {{ play.name }} · {{ tab.tabName }}
          <span class="rule-tag">回報率 {{ tab.rtp }}</span>
        </p>
        <table v-if="tab.groups.length" class="rule-table">
          <thead>
            <tr><th>群組</th><th>注項與賠率</th></tr>
          </thead>
          <tbody>
            <tr v-for="group in tab.groups" :key="group.groupName">
              <td class="is-name">{{ group.groupName }}</td>
              <td>
                <span v-for="item in group.items" :key="item.name" class="is-odds">
                  {{ item.name }} <b>{{ item.odds }}</b>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="rule-note">
      ※ 表中賠率由「公平賠率 × 該分頁回報率」即時推算（含本金），與看板顯示、伺端派彩同一個來源。
      下注時會把當下賠率鎖進注單，之後調整回報率不影響已成立的注單。
    </p>

    <section id="x5-section-prize" class="rule-sec">
      <h4>獎金結構</h4>
      <ul>
        <li>{{ boardName }}玩法每注獨立結算：<strong>派彩 = 下注金額 × 注單鎖定的賠率</strong>（賠率含本金），未中為 0。</li>
        <li>投注額會依固定比例撥入展示用的<strong>共用彩池</strong>，但這個池<strong>不會被信用盤派彩吃掉</strong> ——
          畫面上的「總獎金」是門面數字，不影響任何一注的實際派彩。</li>
        <li v-if="jackpotReady">
          另外還有一份獨立的<strong>爆池</strong>：每注再抽 {{ (mxJackpot.rakeRatio * 100).toFixed(0) }}% 累積，
          開出<strong>{{ mxJackpot.hitLabel }}</strong>那一期，把累積池的
          {{ (mxJackpot.payoutRatio * 100).toFixed(0) }}% 一次發放給該期<strong>有份的注單</strong>
          （未中的注單不算有份），其餘滾存到下一期。
        </li>
        <li v-if="jackpotReady">
          爆池條件的機率是 <strong>{{ jackpotHits }} / {{ X5_TOTAL_COMBOS.toLocaleString('zh-TW') }}
          = {{ jackpotHitRate }}</strong>；累積池未達 <strong>{{ money(mxJackpot.minPool) }}</strong> 時不發放、全額滾存。
        </li>
        <li v-if="jackpotReady">
          爆池<strong>不是平均分</strong>，而是依「注金 × 該注項的權重」比例分配。權重由看板設定決定，
          分級標準是理論賠率（1 ÷ 命中機率）—— 11選5 只有「1-5球」的號碼注項達到第 2 級，其餘注項都是第 1 級。
        </li>
        <li v-if="jackpotReady && mxJackpot.lastHit">
          最近一次爆池：第 {{ mxJackpot.lastHit.issue }} 期（{{ mxJackpot.lastHit.openLabel }}），
          池 {{ money(mxJackpot.lastHit.pool) }} 發出 {{ money(mxJackpot.lastHit.payout) }}，
          共 {{ mxJackpot.lastHit.orders }} 注 / {{ mxJackpot.lastHit.winners }} 人。
        </li>
      </ul>
    </section>

    <section id="x5-section-note" class="rule-sec">
      <h4>特別說明</h4>
      <ul>
        <li><strong>單球大小不對稱</strong>：{{ X5_NUMBER_MAX }} 個號碼切在 {{ X5_BIG_LINE - 1 }}/{{ X5_BIG_LINE }} ——
          大（≥ {{ X5_BIG_LINE }}）只有 {{ ballSideStats.big }} 個號碼、小有 {{ ballSideStats.small }} 個；
          單有 {{ ballSideStats.odd }} 個、雙有 {{ ballSideStats.even }} 個。所以四個面的賠率各不相同。</li>
        <li><strong>總和大小也不對稱</strong>：總和範圍 {{ X5_SUM_MIN }} ~ {{ X5_SUM_MAX }}，
          分佈對稱於 {{ (X5_SUM_MIN + X5_SUM_MAX) / 2 }} 但界線切在
          {{ X5_SUM_BIG_LINE - 1 }}/{{ X5_SUM_BIG_LINE }} ——
          大 {{ sumStats.big }} 組、小 {{ sumStats.small }} 組（共 {{ X5_TOTAL_COMBOS }} 組）。</li>
        <li><strong>總和尾大／尾小</strong>看的是總和的個位數：≥ {{ X5_SUM_TAIL_BIG_LINE }} 為尾大
          （{{ sumStats.tailBig }} 組）、否則尾小（{{ sumStats.tailSmall }} 組）。</li>
        <li><strong>龍虎鬥沒有「和」</strong>：五碼互不重複，兩個球位不可能開出相同號碼，
          所以每組球對只有龍／虎兩個注項（與時時彩、快3 的兩面圍骰不同）。</li>
        <li><strong>全5中1</strong> 是「該號碼出現在開出的 5 碼中任一位置就算中」，命中機率 5 / {{ X5_NUMBER_MAX }}。</li>
        <li>單注與單期限額都是<strong>依分頁獨立計算</strong>，超限會整筆拒單（伺端與畫面讀同一份設定）。</li>
        <li>投注只在「開盤中」受理；封盤後送單會被伺端擋下。</li>
      </ul>
    </section>
  </DialogShell>
</template>

<style scoped lang="scss">
/* 版面與 6hc-of 的遊戲說明同一套：每段落一張帶框的區塊卡片、紅底表頭的表格 */

/* 快捷選單（同 6hc 的 .rule-nav —— 跟著內容捲走，不釘在上方）
   下緣不畫框、只圓上面兩角，與緊接的第一張卡片接在一起 */
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

/* 大段標題（投注玩法／獎金結構）：不是卡片，用來分隔上下兩群 */
.rule-group-title {
  margin: 18px 0 10px;
  font-size: 14px;
  font-weight: 800;
  color: var(--color-red-main);
}

/* 段落卡片 */
.rule-sec {
  margin-bottom: 14px;
  border: 1px solid #fee2e2;
  border-radius: 6px;
  padding: 12px 14px;

  /* 緊接快捷選單的第一張卡片只圓下面兩角，與選單連成一塊 */
  &#x5-section-intro {
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

  /* 清單之後還有表格時要留間距 */
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

/* 表格：紅底表頭、置中、hover 淡紅（同 6hc-of 的 .rule-table）
   欄寬均分並鎖 fixed，各玩法的表才會上下對齊 */
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
    display: inline-block;
    margin: 2px 6px;
    font-weight: 700;
    color: #d97706;
  }

  em {
    font-style: normal;
    color: #d97706;
  }
}

/* 時間流程的狀態徽章（同 6hc-of） */
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

/* 每個分頁一塊，標題右邊掛回報率／複式的小標籤 */
.rule-block {
  & + .rule-block {
    margin-top: 0.9rem;
  }
}

.rule-tag {
  display: inline-block;
  margin-left: 6px;
  border: 1px solid var(--color-red-content);
  border-radius: 999px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-red-desc);
  vertical-align: middle;
}
</style>
