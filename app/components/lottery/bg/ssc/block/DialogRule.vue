<script setup lang="ts">
import { computed } from 'vue'
import DialogShell from '~/components/lottery/bg/ssc/block/DialogShell.vue'
import { SSC_SUM_BIG_LINE } from '#shared/config/ssc-cd'
import { SSC_BALL_COUNT, SSC_DIGIT_MAX, sscSumCounts, SSC_TOTAL_OUTCOMES } from '#shared/config/ssc'
import { sscOgChanceOf, SSC_OG_MAX_COMBO } from '#shared/config/sscog'
import C_PLAYS from '#shared/config/ssccd/plays'
import { sscRtpOf, sscTabOddsOf } from '#shared/config/ssccd/helpers'
import { sscOgPlays, sscOgRtpOf, sscOgTabOddsOf, sscOgComboOf } from '#shared/config/sscog/helpers'
import { useSsc } from '~/composables/useSsc'

/**
 * 玩法說明
 *
 * 注項表、賠率、機率一律由 config + ssc 的機率層推算 —— 改設定就自動跟上，不寫死數字。
 * 這也是「UI 依 config 顯示」的一部分：新增一個分頁或注項，說明頁會自己長出來。
 *
 * ⚠️ 與 pk10/k3 最大的不同：時時彩兩個盤口**都是固定賠率**，官方盤沒有彩池分層玩法，
 *    所以本檔沒有「獎池滾存」那一段，「獎金結構」也不用列分層表。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

/**
 * 說明內容依當前盤口切換
 *
 * 兩個盤口的開獎號、彩池、時間流程都共用（那幾段兩邊一樣），但「投注玩法」與
 * 「獎金結構」是各自的 —— 在官方盤看到信用盤的注項表只會混淆，所以只列當前盤口的。
 */
const { isCd } = useSsc()
const boardName = computed(() => (isCd.value ? '信用' : '官方'))

/** 上方快捷選單 */
const NAV_ITEMS = [
  { id: 'ssc-section-intro', label: '遊戲簡介' },
  { id: 'ssc-section-timeline', label: '時間流程' },
  { id: 'ssc-section-play', label: '投注玩法' },
  { id: 'ssc-section-prize', label: '獎金結構' },
  { id: 'ssc-section-note', label: '特別說明' }
]

/** 每期 7 分鐘（與 6hc / k3 / pk10 共用 server game/lottery/bg/base.ts 的 timer.getStatusBySeconds） */
const TIMELINE = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒 — 5 分 50 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒 — 6 分 00 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒 — 6 分 40 秒', status: '正在開獎中', desc: `開出 ${SSC_BALL_COUNT} 個號碼球` },
  { range: '6 分 40 秒 後', status: '已開獎', desc: '逐注結算派彩，可查閱結果' }
]

/** 總和大小的組數（0 為小、≥ SSC_SUM_BIG_LINE 為大），供特別說明引用 */
const sumCounts = sscSumCounts()
const sumSmallTotal = computed(() =>
  Object.keys(sumCounts).map(Number).filter((sum) => sum < SSC_SUM_BIG_LINE)
    .reduce((acc, sum) => acc + Number(sumCounts[sum] ?? 0), 0)
)
const sumBigTotal = computed(() => SSC_TOTAL_OUTCOMES - sumSmallTotal.value)

/**
 * 官方盤複式分頁的樣本注碼
 *
 * 複式分頁沒有固定注項清單，說明頁改列「規則 + 一組樣本注碼的賠率／機率」——
 * 同一個複式分頁裡每一注的機率都相同（號碼獨立均勻分布），任一組合皆可代表整個分頁。
 */
const _ogSample = (combo: { mode: string; prefix: string; positions?: number; group?: string }): string => {
  if (combo.mode === 'group') {
    const size = combo.group === 'group6' ? 3 : 2
    return `${combo.prefix}${Array.from({ length: size }, (_, i) => i).join('')}`
  }
  const positions = Number(combo.positions ?? 0)
  if (combo.mode === 'sides') return `${combo.prefix}${'大'.repeat(positions)}`
  return `${combo.prefix}${Array.from({ length: positions }, (_, i) => i % (SSC_DIGIT_MAX + 1)).join('')}`
}

/**
 * 信用盤的注項表：依「玩法 → 分頁 → 群組 → 注項」攤平
 *
 * 賠率用 helpers 依該分頁 rtp 即時推算（與看板、伺端派彩同一支）。有些分頁（1-5球、全5中1、
 * 鬥牛、梭哈）注項數多達 10~50 個，用「群組名 + 一整排注項/賠率」的緊湊版面，不逐項起一列。
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
        rtp: `${(sscRtpOf(play.key, tabId) * 100).toFixed(0)}%`,
        groups: (tab.tabGroup ?? []).map((group: any) => ({
          groupName: String(group.groupName ?? ''),
          items: (group.groupList ?? []).map((item: any) => ({
            name: String(item.name ?? ''),
            odds: sscTabOddsOf(play.key, tabId, String(item.name))
          })).filter((item: { odds: number }) => item.odds > 0)
        })).filter((group: { items: unknown[] }) => group.items.length > 0)
      }
    })
  }))
)

/**
 * 官方盤的注項表
 *
 * 兩種分頁型態：
 *   單選分頁（定位膽）—— 與信用盤同一種緊湊版面
 *   複式分頁（其餘 10 個）—— 沒有固定注項清單，改列選號規則 + 樣本注碼的賠率／機率
 */
const ogPlayTables = computed(() =>
  sscOgPlays().map((play) => ({
    key: String(play.key ?? ''),
    name: String(play.name ?? ''),
    tabs: (play.list ?? []).map((tab: any) => {
      const tabId = Number(tab.tabId)
      const combo = sscOgComboOf(play.key, tabId)
      const rtp = sscOgRtpOf(play.key, tabId)
      if (combo) {
        const sample = _ogSample(combo)
        const odds = sscOgTabOddsOf(play.key, tabId, sample)
        const chance = sscOgChanceOf(sample)
        return {
          tabId,
          tabName: String(tab.tabName ?? ''),
          rtp: `${(rtp * 100).toFixed(0)}%`,
          combo: {
            mode: combo.mode,
            positions: combo.positions ?? 0,
            group: combo.group ?? null,
            sample,
            odds,
            percent: chance && chance.total > 0 ? ((chance.hit / chance.total) * 100).toFixed(4) : '—'
          },
          groups: []
        }
      }
      return {
        tabId,
        tabName: String(tab.tabName ?? ''),
        rtp: `${(rtp * 100).toFixed(0)}%`,
        combo: null,
        groups: (tab.tabGroup ?? []).map((group: any) => ({
          groupName: String(group.groupName ?? ''),
          items: (group.groupList ?? []).map((item: any) => ({
            name: String(item.name ?? ''),
            odds: sscOgTabOddsOf(play.key, tabId, String(item.name))
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
  <DialogShell :visible="props.visible" :title="`遊戲說明 — 時時彩${boardName}玩法`" width="min(1100px, 96vw)"
    @close="emit('close')">
    <!-- 上方快捷選單 -->
    <nav class="rule-nav">
      <button v-for="item in NAV_ITEMS" :key="item.id" type="button" class="rule-nav-btn"
        @click="click.scrollTo(item.id)">
        {{ item.label }}
      </button>
    </nav>

    <section id="ssc-section-intro" class="rule-sec">
      <h4>遊戲簡介</h4>
      <ul>
        <li>每期開出 <strong>{{ SSC_BALL_COUNT }} 個號碼球</strong>，每個 0 ~ {{ SSC_DIGIT_MAX }} 且<strong>可以重複</strong>，
          共 {{ SSC_DIGIT_MAX + 1 }}<sup>{{ SSC_BALL_COUNT }}</sup> = <strong>{{ SSC_TOTAL_OUTCOMES.toLocaleString('zh-TW') }}</strong> 種等機率結果。</li>
        <li>目前檢視的是 <strong>時時彩 {{ boardName }}玩法</strong>。
          信用玩法有 1-5球／兩面／前中後三／全5中1／龍虎鬥／鬥牛／梭哈共 7 個分頁；
          官方玩法本輪納入定位膽／二星／後三／五星／大小單雙共 11 個分頁（其餘玩法尚未實作）。</li>
        <li>兩種玩法<strong>共用同一份開獎號與彩池</strong> —— 同一期的號碼必然相同，抽水也累積到同一個池。</li>
        <li>賠率一律由「公平賠率 × 回報率」推算，不是拍板數字：公平賠率 = 該注項的母數 ÷ 命中數
          （母數由 config + 機率層窮舉而來，不同分頁的母數不同，見各分頁說明）。</li>
      </ul>
    </section>

    <section id="ssc-section-timeline" class="rule-sec">
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
      <p class="rule-note">※ 信用玩法與官方玩法共用同一份期表，同一期的時間點完全一致。</p>
    </section>

    <h3 id="ssc-section-play" class="rule-group-title">投注玩法 · 時時彩 {{ boardName }}玩法（固定賠率）</h3>

    <!-- ── 信用盤：7 個分頁 ── -->
    <template v-if="isCd">
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
    </template>

    <!-- ── 官方盤：11 個分頁，10 個是複式 ── -->
    <template v-else>
      <section v-for="play in ogPlayTables" :key="`og-${play.key}`" class="rule-block">
        <div v-for="tab in play.tabs" :key="`og-${play.key}-${tab.tabId}`">
          <p class="rule-group-title">
            {{ play.name }} · {{ tab.tabName }}
            <span class="rule-tag">回報率 {{ tab.rtp }}</span>
            <span v-if="tab.combo" class="rule-tag">複式</span>
          </p>

          <!-- 複式分頁：沒有固定注項清單，列規則與樣本注碼 -->
          <ul v-if="tab.combo">
            <li v-if="tab.combo.mode === 'direct'">
              每個位置各選一組號碼，笛卡爾積展開成一注一注的直選
              （選 n 個位置 × 各位置選數 → 相乘為注數；<strong>號碼可重複</strong>，不像 pk10 的名次排列要濾掉重複）。
            </li>
            <li v-else-if="tab.combo.mode === 'sides'">
              每個位置各選一組面（大／小／單／雙），笛卡爾積展開成一注一注
              （{{ tab.combo.positions }} 個位置，各位置面數相乘為注數）。
            </li>
            <li v-else>
              從一組號碼中選出 <strong>{{ tab.combo.group === 'group6' ? 3 : 2 }} 個以上</strong>不同號碼，
              取 {{ tab.combo.group === 'group6' ? '3' : '2' }} 個一組成一注
              （選 n 個 → C(n,{{ tab.combo.group === 'group6' ? 3 : 2 }}) 注）。
            </li>
            <li>每一注的機率相同 —— 賠率 <strong>{{ tab.combo.odds }}</strong>、
              命中機率 {{ tab.combo.percent }}%（例：{{ tab.combo.sample }}）。</li>
          </ul>

          <!-- 單選分頁（定位膽）：同信用盤的緊湊版面 -->
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
    </template>

    <p class="rule-note">
      ※ 表中賠率由「公平賠率 × 該分頁回報率」即時推算（含本金），與看板顯示、伺端派彩同一個來源。
      下注時會把當下賠率鎖進注單，之後調整回報率不影響已成立的注單。
    </p>

    <section id="ssc-section-prize" class="rule-sec">
      <h4>獎金結構</h4>
      <ul>
        <li>{{ boardName }}玩法每注獨立結算：<strong>派彩 = 下注金額 × 注單鎖定的賠率</strong>（賠率含本金），未中為 0。</li>
        <li>兩個盤口<strong>都是固定賠率</strong> —— 時時彩沒有 pk10 / k3 那種依命中數分層、從彩池撥發的玩法，
          官方玩法的<strong>後三直選</strong>、<strong>五星直選</strong>等也是固定倍數，不是獎池分層。</li>
        <li v-if="isCd">
          <strong>龍虎鬥的「和」是獨立注項</strong>（兩球相同）——判定只有中／不中兩種結果，
          不是像快3 兩面圍骰那樣退還本金。
        </li>
        <li>投注額仍會依固定比例撥入信用／官方共用的展示用彩池，但<strong>彩池不會被派彩吃掉</strong>——
          畫面上的「總獎金」純粹是門面數字，不影響任何一注的實際派彩。</li>
      </ul>
    </section>

    <section id="ssc-section-note" class="rule-sec">
      <h4>特別說明</h4>
      <ul>
        <li>總和（0 ~ {{ SSC_DIGIT_MAX * SSC_BALL_COUNT }}）窮舉共 {{ SSC_TOTAL_OUTCOMES.toLocaleString('zh-TW') }} 種結果，
          大（≥ {{ SSC_SUM_BIG_LINE }}）／小剛好對半：{{ sumBigTotal.toLocaleString('zh-TW') }} / {{ sumSmallTotal.toLocaleString('zh-TW') }}，
          與 pk10 冠亞和「大小機率不對稱」不同。</li>
        <li v-if="isCd">前中後三的<strong>順子不含環狀</strong> —— 890、901 這種頭尾相接不算順子，歸半順或雜六。</li>
        <li v-if="isCd"><strong>牛牛視為 10 點</strong>；牛大＝牛點 ≥ 6（含牛牛）、牛小＝ 1 ~ 5；
          <strong>沒牛不屬於任何一面</strong>（大小單雙都不算中）。</li>
        <li>號碼<strong>可以重複</strong>，複式的位置型玩法（五星／後三直選／後二直選等）不像 pk10 名次排列那樣濾掉重複組合。</li>
        <li v-if="!isCd">五星直選若每個位置都全選會展開成 100,000 注，系統設有上限
          <strong>{{ SSC_OG_MAX_COMBO.toLocaleString('zh-TW') }} 注</strong> —— 超過會整筆拒絕，請縮小選號範圍。</li>
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
  &#ssc-section-intro {
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
