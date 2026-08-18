<script setup lang="ts">
import { computed } from 'vue'
import DialogShell from '~/components/lottery/bg/pk10/block/DialogShell.vue'
import {
  PK10_CAR_COUNT,
  PK10_PAIR_TOTAL,
  PK10_RANK_NAMES,
  PK10_SUM_BIG_LINE,
  PK10_BIG_LINE,
  PK10_SUM_COUNTS
} from '#shared/config/pk10'
import { PK10_OF_PRIZE_TIERS, PK10_OF_PICK_COUNT, pk10OfMatchCounts } from '#shared/config/pk10-of'
import C_PLAYS from '#shared/config/pk10cd/plays'
import { pk10RtpOf, pk10TabOddsOf } from '#shared/config/pk10cd/helpers'
import { pk10OgPlays, pk10OgRtpOf, pk10OgTabOddsOf, pk10OgComboOf } from '#shared/config/pk10og/helpers'
import { usePk10 } from '~/composables/usePk10'

/**
 * 玩法說明
 *
 * 注項表、賠率、機率一律由 config + pk10 的機率層推算 —— 改設定就自動跟上，不寫死數字。
 * 這也是「UI 依 config 顯示」的一部分：新增一個分頁或注項，說明頁會自己長出來。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

/**
 * 說明內容依當前盤口切換
 *
 * 兩個盤口的開獎號、彩池、時間流程都共用（那幾段兩邊一樣），但「投注玩法」與
 * 「獎金結構」是各自的 —— 在官方盤看到信用盤的注項表只會混淆，所以只列當前盤口的。
 */
const { isCd } = usePk10()
const boardName = computed(() => (isCd.value ? '信用' : '官方'))

/** 上方快捷選單 */
const NAV_ITEMS = [
  { id: 'pk10-section-intro', label: '遊戲簡介' },
  { id: 'pk10-section-timeline', label: '時間流程' },
  { id: 'pk10-section-sum', label: '冠亞和分布' },
  { id: 'pk10-section-play', label: '投注玩法' },
  { id: 'pk10-section-prize', label: '獎金結構' },
  { id: 'pk10-section-note', label: '特別說明' }
]

/** 每期 7 分鐘（與 6hc / k3 共用 server game/lottery/bg/base.ts 的 timer.getStatusBySeconds） */
const TIMELINE = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒 — 5 分 50 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒 — 6 分 00 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒 — 6 分 40 秒', status: '正在開獎中', desc: `${PK10_CAR_COUNT} 台車競速中` },
  { range: '6 分 40 秒 後', status: '已開獎', desc: '逐注結算派彩，可查閱結果' }
]

/** 冠亞和分布（3 ~ 19，母數 90，由 config 層窮舉建表） */
const sumRows = computed(() =>
  Object.keys(PK10_SUM_COUNTS).map(Number).sort((a, b) => a - b).map((sum) => ({
    sum,
    count: Number(PK10_SUM_COUNTS[sum] ?? 0),
    percent: ((Number(PK10_SUM_COUNTS[sum] ?? 0) / PK10_PAIR_TOTAL) * 100).toFixed(2)
  }))
)

/**
 * 注項表：依當前盤口把 config 攤平成「玩法 → 分頁 → 群組 → 注項」
 *
 * 賠率用 helpers 依該分頁 rtp 即時推算（與看板、伺端派彩同一支），
 * 複式分頁沒有固定注項清單，改標選號規則。
 */
const playTables = computed(() => {
  const plays = (isCd.value ? C_PLAYS : pk10OgPlays()) as Array<any>
  return plays.map((play) => ({
    key: String(play.key ?? ''),
    name: String(play.name ?? ''),
    tabs: (play.list ?? []).map((tab: any) => {
      const tabId = Number(tab.tabId)
      const combo = isCd.value ? null : pk10OgComboOf(play.key, tabId)
      const rtp = isCd.value ? pk10RtpOf(play.key, tabId) : pk10OgRtpOf(play.key, tabId)
      return {
        tabId,
        tabName: String(tab.tabName ?? ''),
        rtp: `${(rtp * 100).toFixed(0)}%`,
        quota: tab.settings?.quota ?? null,
        combo,
        groups: (tab.tabGroup ?? []).map((group: any) => ({
          groupName: String(group.groupName ?? ''),
          items: (group.groupList ?? [])
            .map((item: any) => ({
              name: String(item.name ?? ''),
              odds: isCd.value
                ? pk10TabOddsOf(play.key, tabId, String(item.name))
                : pk10OgTabOddsOf(play.key, tabId, String(item.name))
            }))
            // 複式分頁的 groupList 是「可選車號」而不是注碼，沒有賠率就不列
            .filter((item: { odds: number }) => item.odds > 0)
        })).filter((group: { items: unknown[] }) => group.items.length > 0)
      }
    })
  }))
})

/** 前三直選的命中分布（供獎金結構那段列表） */
const matchRows = computed(() => {
  const table = pk10OfMatchCounts()
  const total = table.reduce((sum, count) => sum + count, 0)
  return PK10_OF_PRIZE_TIERS.map((tier) => ({
    match: tier.match,
    name: tier.name,
    payout: tier.type === 'pool'
      ? `獎池 ${Math.round(tier.ratio * 100)}%${tier.minAmount ? `（每單位最低保障 ${tier.minAmount.toLocaleString('zh-TW')}）` : ''}`
      : `固定 ${tier.amount} 倍`,
    count: Number(table[tier.match] ?? 0),
    percent: total > 0 ? ((Number(table[tier.match] ?? 0) / total) * 100).toFixed(4) : '0'
  }))
})

const click = {
  /** 快捷選單：捲到對應段落（scrollIntoView 會自己找捲動容器，不用接 DialogShell 的 ref） */
  scrollTo: (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <DialogShell :visible="props.visible" :title="`遊戲說明 — PK10 ${boardName}玩法`" width="min(1100px, 96vw)"
    @close="emit('close')">
    <!-- 上方快捷選單 -->
    <nav class="rule-nav">
      <button v-for="item in NAV_ITEMS" :key="item.id" type="button" class="rule-nav-btn"
        @click="click.scrollTo(item.id)">
        {{ item.label }}
      </button>
    </nav>

    <section id="pk10-section-intro" class="rule-sec">
      <h4>遊戲簡介</h4>
      <ul>
        <li>每期 <strong>{{ PK10_CAR_COUNT }} 台車</strong>競速，開出第 1 ~ 第 {{ PK10_CAR_COUNT }} 名的車號 ——
          開獎號是 1 ~ {{ PK10_CAR_COUNT }} 的一個<strong>排列</strong>，同一台車不會出現在兩個名次。</li>
        <li>目前檢視的是 <strong>PK10 {{ boardName }}玩法</strong>。
          信用玩法有定位膽／兩面／冠亞組合／冠亞軍和／龍虎鬥五類，每注獨立、按賠率派彩；
          官方玩法是前一／前二／前三直選與定位膽，其中<strong>前三直選</strong>依命中名次數分層從獎池分配。</li>
        <li>兩種玩法<strong>共用同一份開獎號與彩池</strong> —— 同一期的名次必然相同，抽水也累積到同一個池。</li>
        <li>賠率一律由「公平賠率 × 回報率」推算，不是拍板數字：
          單一名次的母數是 {{ PK10_CAR_COUNT }}（該名次的車號均勻分布），
          冠亞軍兩名的母數是 {{ PK10_PAIR_TOTAL }}（有序且相異的車號對）。</li>
      </ul>
    </section>

    <section id="pk10-section-timeline" class="rule-sec">
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

    <section id="pk10-section-sum" class="rule-sec">
      <h4>冠亞和分布（{{ PK10_PAIR_TOTAL }} 組有序車號對窮舉）</h4>
      <table class="rule-table">
        <thead>
          <tr><th>和值</th><th v-for="row in sumRows" :key="row.sum">{{ row.sum }}</th></tr>
        </thead>
        <tbody>
          <tr><td>組數</td><td v-for="row in sumRows" :key="row.sum">{{ row.count }}</td></tr>
          <tr><td>機率%</td><td v-for="row in sumRows" :key="row.sum">{{ row.percent }}</td></tr>
        </tbody>
      </table>
      <p class="rule-note">
        ※ 分布<strong>不對稱</strong>：和值 {{ PK10_SUM_BIG_LINE - 1 }} 獨佔 10 組且屬「小」與「單」，
        所以「和小」「和單」的機率是 50/{{ PK10_PAIR_TOTAL }}、「和大」「和雙」是 40/{{ PK10_PAIR_TOTAL }} ——
        兩邊賠率本來就不一樣，不是設定錯誤。冠亞和 ≥ {{ PK10_SUM_BIG_LINE }} 為大。
      </p>
    </section>

    <section id="pk10-section-play" class="rule-sec">
      <h4>投注玩法（{{ boardName }}玩法）</h4>
      <template v-for="play in playTables" :key="play.key">
        <div v-for="tab in play.tabs" :key="`${play.key}-${tab.tabId}`" class="rule-block">
          <p class="rule-group-title">
            {{ play.name }} · {{ tab.tabName }}
            <span class="rule-tag">回報率 {{ tab.rtp }}</span>
            <span v-if="tab.quota" class="rule-tag">
              單注 {{ tab.quota.item?.min }} — {{ tab.quota.item?.max }}
            </span>
            <span v-if="tab.combo" class="rule-tag">
              複式 · {{ tab.combo.positions }} 個名次{{ tab.combo.pool ? ' · 彩池分層' : '' }}
            </span>
          </p>
          <p v-if="tab.combo" class="rule-note">
            每個名次各選一組車號，送單時展開成一注一注的直選（注數 = 各名次選數相乘，
            同一台車佔兩個名次的組合會自動濾掉）。
            {{ tab.combo.pool ? '本分頁走獎池分層，沒有固定賠率。' : '' }}
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
      </template>
      <p class="rule-note">
        ※ 表中賠率由「公平賠率 × 該分頁回報率」即時推算（含本金），與看板顯示、伺端派彩同一個來源。
        下注時會把當下賠率鎖進注單，之後調整回報率不影響已成立的注單。
      </p>
    </section>

    <section id="pk10-section-prize" class="rule-sec">
      <h4>獎金結構</h4>
      <template v-if="isCd">
        <ul>
          <li>信用玩法每注獨立：中獎派彩 = 注金 × 注單鎖定的賠率（含本金），未中為 0。</li>
          <li>PK10 名次必然分得出來、車號互異，因此<strong>沒有和局</strong> ——
            只有中／不中兩種結果（不像快3 的大小單雙遇圍骰要退本金）。</li>
          <li>投注額的固定比例會撥入與官方玩法共用的彩池；賠率派彩本身由莊家支付。</li>
        </ul>
      </template>
      <template v-else>
        <p class="rule-note">
          官方玩法兩套派彩並存：前一／前二直選與定位膽走固定賠率；
          <strong>前三直選</strong>（依序猜冠、亞、季軍共 {{ PK10_OF_PICK_COUNT }} 個名次）走獎池分層。
        </p>
        <table class="rule-table">
          <thead>
            <tr><th>命中名次數</th><th>獎項</th><th>派彩方式</th><th>組數 / 720</th><th>機率%</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in matchRows" :key="row.match">
              <td class="is-name">{{ row.match }} 個</td>
              <td>{{ row.name }}</td>
              <td>{{ row.payout }}</td>
              <td>{{ row.count }}</td>
              <td>{{ row.percent }}</td>
            </tr>
          </tbody>
        </table>
        <p class="rule-note">
          ※ 前三名共 10 × 9 × 8 = 720 種等機率結果。命中是<strong>逐位比對</strong> ——
          猜 [3,5,7] 而開出 [3,7,5] 只算中 1 個（冠軍），因為名次有序。
          pool 型分層若該期沒有人中，該層獎金整塊滾存至下期。
        </p>
      </template>
    </section>

    <section id="pk10-section-note" class="rule-sec">
      <h4>特別說明</h4>
      <ul>
        <li><strong>兩面</strong>：車號 ≥ {{ PK10_BIG_LINE }} 為大；冠亞和 ≥ {{ PK10_SUM_BIG_LINE }} 為大。</li>
        <li><strong>龍虎鬥</strong>：第 i 名對第 {{ PK10_CAR_COUNT + 1 }} − i 名，只有前
          {{ PK10_CAR_COUNT / 2 }} 個名次有（{{ PK10_RANK_NAMES[0] }} 對
          {{ PK10_RANK_NAMES[PK10_CAR_COUNT - 1] }}，依此類推）。車號互異故必分勝負。</li>
        <li><strong>冠亞組合</strong>：不分順序 —— 選 01-02 時，開出「冠軍 01 / 亞軍 02」或
          「冠軍 02 / 亞軍 01」都算中，所以命中 2 組（機率 2/{{ PK10_PAIR_TOTAL }}）。</li>
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
  &#pk10-section-intro {
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
    font-weight: 700;
    color: #d97706;
  }

  em {
    font-style: normal;
    color: #d97706;
  }
}

/* 和值分布是 17 欄的寬表，不能均分（會擠爆），改水平捲動 */
#k3-section-timeline .rule-table th,
#k3-section-timeline .rule-table td {
  width: auto;
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

/* PK10 專屬：注項表一個分頁一塊，標題右邊掛回報率／限額／複式規則的小標籤 */
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
