<script setup lang="ts">
import { computed } from 'vue'
import DialogShell from '~/components/lottery/bg/kl8/block/DialogShell.vue'
import {
  kl8OddsOf,
  kl8RenxuanSampleCode,
  KL8_BALL_COUNT,
  KL8_JACKPOT_SETTINGS,
  KL8_NUMBER_MAX,
  KL8_SUM_BIG_LINE,
  KL8_SUM_MAX,
  KL8_SUM_MIN,
  KL8_TOTAL_COMBOS,
  KL8_WUXING_BOUNDS
} from '#shared/config/kl8-cd'
import { KL8_HALF_LINE } from '#shared/config/kl8'
import C_PLAYS from '#shared/config/kl8cd/plays'
import { kl8ChosenOf, kl8RtpOf, kl8TabOddsOf } from '#shared/config/kl8cd/helpers'

/**
 * 玩法說明
 * 賠率與機率一律由 config / kl8-cd 推算，改設定就自動跟上（不寫死數字）
 *
 * ⚠️ 任選的注項名稱不含號碼（`任三中三`），賠率要用注碼樣板去推（kl8RenxuanSampleCode）。
 * ⚠️ 快樂8只有「任選」「兩面」兩個玩法，沒有 kl10 的正和／龍虎鬥；兩面多一組「五行」。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const combosLabel = KL8_TOTAL_COMBOS.toLocaleString('zh-TW')

/**
 * 爆池說明的數字一律讀 KL8_JACKPOT_SETTINGS，不寫死 ——
 * 之後調整觸發條件、發放比例或門檻，說明頁自動跟上
 */
const JACKPOT = KL8_JACKPOT_SETTINGS
const jackpotHitRate = `${(JACKPOT.hitRate * 100).toFixed(2)}%`
const jackpotPayoutPct = `${(JACKPOT.payoutRatio * 100).toFixed(0)}%`
const jackpotRakePct = `${(JACKPOT.rakeRatio * 100).toFixed(0)}%`

/** 五行等機率五等分邊界（依 20 球總和） */
const wuxingDesc = (() => {
  const [b0, b1, b2, b3] = KL8_WUXING_BOUNDS
  return `金 ≤${b0}／木 ${(b0 ?? 0) + 1}~${b1}／水 ${(b1 ?? 0) + 1}~${b2}／火 ${(b2 ?? 0) + 1}~${b3}／土 ≥${(b3 ?? 0) + 1}`
})()

/** 各玩法的爆池權重（讀看板設定，與實際分配用的是同一份資料） */
const JACKPOT_WEIGHTS = (C_PLAYS as any[]).map((play) => {
  const items = (play.list ?? []).flatMap((tab: any) => (tab.tabGroup ?? []).flatMap((group: any) => group.groupList ?? []))
  const levels = Array.from(new Set(items.map((item: any) => Number(item.weight ?? 0)))).sort((a, b) => b - a)
  return { name: String(play.name ?? ''), tabs: (play.list ?? []).length, levels }
})

const NAV_ITEMS = [
  { id: 'kl8-section-intro', label: '遊戲簡介' },
  { id: 'kl8-section-timeline', label: '時間流程' },
  { id: 'kl8-section-chance', label: '機率速查' },
  { id: 'kl8-section-play', label: '投注玩法' },
  { id: 'kl8-section-jackpot', label: '爆池' },
  { id: 'kl8-section-note', label: '特別說明' }
]

/** 每期 7 分鐘（與 6hc / k3 共用 server game/lottery/bg/base.ts 的 timer.getStatusBySeconds） */
const TIMELINE = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒 — 5 分 50 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒 — 6 分 00 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒 — 6 分 40 秒', status: '正在開獎中', desc: `開出 ${KL8_BALL_COUNT} 個號碼（1~${KL8_NUMBER_MAX} 不重複）` },
  { range: '6 分 40 秒 後', status: '已開獎', desc: '逐注結算派彩，可查閱結果' }
]

const click = {
  scrollTo: (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/** 該注項用來推賠率的注碼（任選要補號碼，其餘注項名稱本身就是注碼） */
const _codeOf = (playKey: string, tabId: number, name: string) => {
  const chosen = kl8ChosenOf(playKey, tabId)
  return chosen ? kl8RenxuanSampleCode(chosen.pick) : name
}

/** 各玩法的注項表（含命中機率，由公平賠率反推：機率 = 1 / 公平賠率） */
const PLAY_ROWS = computed(() =>
  (C_PLAYS as any[]).map((play) => ({
    key: play.key,
    name: play.name,
    tabs: (play.list ?? []).map((tab: any) => ({
      tabName: tab.tabName,
      rtp: kl8RtpOf(play.key, tab.tabId),
      groups: tab.tabGroup.map((group: any) => ({
        groupName: group.groupName,
        items: group.groupList.map((item: any) => {
          const code = _codeOf(play.key, tab.tabId, String(item.name))
          const odds = kl8TabOddsOf(play.key, tab.tabId, code)
          const fair = kl8OddsOf(code, 1)
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

/**
 * 機率速查
 * ⚠️ 不畫「總和 210~1410 逐值分布」那張表 —— 上千個欄位在彈窗裡讀不了；
 *    這裡列的是實際可下注的兩面注項機率（數字同樣由 kl8-cd 推算，不寫死）。
 */
const CHANCE_ROWS = computed(() => {
  const rows: Array<{ group: string; name: string; odds: number; percent: string }> = []
  const push = (group: string, code: string) => {
    const fair = kl8OddsOf(code, 1)
    rows.push({
      group,
      name: code,
      odds: kl8OddsOf(code),
      percent: fair > 0 ? (100 / fair).toFixed(4) : '—'
    })
  }
  ;['大', '小', '單', '雙', '大單', '大雙', '小單', '小雙'].forEach((code) => push('和值', code))
  ;['上盤', '上下和', '下盤'].forEach((code) => push('上下盤', code))
  ;['奇盤', '奇偶和', '偶盤'].forEach((code) => push('奇偶盤', code))
  ;['金', '木', '水', '火', '土'].forEach((code) => push('五行', code))
  ;['任一中一', '任三中三', '任五中五', '任七中七'].forEach((_name, idx) =>
    push('任選', kl8RenxuanSampleCode([1, 3, 5, 7][idx] as number))
  )
  return rows
})
</script>

<template>
  <DialogShell :visible="props.visible" title="遊戲說明 — 快樂8信用玩法" width="min(1100px, 96vw)" @close="emit('close')">
    <nav class="rule-nav">
      <button v-for="item in NAV_ITEMS" :key="item.id" type="button" class="rule-nav-btn"
        @click="click.scrollTo(item.id)">
        {{ item.label }}
      </button>
    </nav>

    <section id="kl8-section-intro" class="rule-sec">
      <h4>遊戲簡介</h4>
      <ul>
        <li>每期從 1 ~ {{ KL8_NUMBER_MAX }} 開出 <strong>{{ KL8_BALL_COUNT }} 個號碼</strong>（互不重複、無球位順序），
          號碼組合共 C({{ KL8_NUMBER_MAX }},{{ KL8_BALL_COUNT }}) = <strong>{{ combosLabel }}</strong> 種，
          全部可窮舉、機率是精確值。</li>
        <li>快樂8<strong>只有信用玩法</strong>，沒有官方玩法／共用彩池 —— 每注獨立、按賠率派彩。</li>
        <li>賠率一律由「公平賠率 × 回報率」推算（公平賠率 = 母數 ÷ 該注項命中數），不是拍板數字，
          因此每個注項的期望回報率一致。</li>
        <li>母數依判定對象不同：<strong>任選</strong>為 C({{ KL8_NUMBER_MAX }},N)、
          <strong>和值／上下盤／奇偶盤／五行</strong>為 20 球集合的母數 C({{ KL8_NUMBER_MAX }},{{ KL8_BALL_COUNT }})。</li>
      </ul>
    </section>

    <section id="kl8-section-timeline" class="rule-sec">
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

    <section id="kl8-section-chance" class="rule-sec">
      <h4>機率速查（兩面母數 C({{ KL8_NUMBER_MAX }},{{ KL8_BALL_COUNT }}) = {{ combosLabel }}）</h4>
      <table class="rule-table">
        <thead><tr><th>分組</th><th>注項</th><th>賠率</th><th>命中機率%</th></tr></thead>
        <tbody>
          <tr v-for="row in CHANCE_ROWS" :key="`${row.group}-${row.name}`">
            <td>{{ row.group }}</td>
            <td class="is-name">{{ row.name }}</td>
            <td class="is-odds">{{ row.odds }}</td>
            <td>{{ row.percent }}</td>
          </tr>
        </tbody>
      </table>
      <p class="rule-note">
        ※ 總和範圍 {{ KL8_SUM_MIN }} ~ {{ KL8_SUM_MAX }}：總和 ≥ {{ KL8_SUM_BIG_LINE }} 為大、&lt; {{ KL8_SUM_BIG_LINE }} 為小
        （無和局，{{ KL8_SUM_BIG_LINE }} 併入大）。
        任選列出的是各分頁的代表注碼，同分頁換號碼不影響賠率。
      </p>
    </section>

    <h3 id="kl8-section-play" class="rule-group-title">投注玩法 · 快樂8信用玩法（賠率制）</h3>
    <section v-for="play in PLAY_ROWS" :key="play.key" class="rule-sec">
      <h4>{{ play.name }}</h4>
      <div v-for="tab in play.tabs" :key="tab.tabName">
        <p class="rule-note">{{ tab.tabName }} · 回報率 {{ (tab.rtp * 100).toFixed(0) }}%</p>
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

    <section id="kl8-section-jackpot" class="rule-sec">
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
            <tr><th>玩法</th><th>分頁數</th><th>注項權重</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in JACKPOT_WEIGHTS" :key="row.name">
              <td>{{ row.name }}</td>
              <td>{{ row.tabs }}</td>
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

    <section id="kl8-section-note" class="rule-sec">
      <h4>特別說明</h4>
      <ul>
        <li><strong>任選</strong>：所選號碼<strong>全部</strong>出現在當期
          {{ KL8_BALL_COUNT }} 個開獎號中才算中獎，沒有部分中獎。
          多選號碼時會依組合展開成多注（例：任二中二選 4 個號碼 = C(4,2) = 6 注），每注各自計算。</li>
        <li><strong>兩面 · 和值</strong>：20 球總和 ≥ {{ KL8_SUM_BIG_LINE }} 為大、&lt; {{ KL8_SUM_BIG_LINE }} 為小（無和局）；
          單／雙看總和本身的奇偶；大單／大雙／小單／小雙為兩者的組合。</li>
        <li><strong>兩面 · 上下盤</strong>：號碼 ≤ {{ KL8_HALF_LINE }} 的個數與 &gt; {{ KL8_HALF_LINE }} 的個數比多寡，
          小號多為上盤、大號多為下盤、10:10 為和盤（注碼寫作「上下和」）。
          <strong>奇偶盤</strong>同理比奇數與偶數的個數（注碼「奇偶和」）。</li>
        <li><strong>兩面 · 五行</strong>：依 20 球總和落在等機率五等分區間分金木水火土 —— {{ wuxingDesc }}。</li>
        <li><strong>賠率在下注當下就鎖進注單</strong>，之後調整設定或回報率都不影響已成立的注單。</li>
        <li>單注與單期限額由各分頁的設定決定，超限伺端會<strong>整筆拒單</strong>（不會只擋超出的部分）。
          任選是複式玩法，注數會隨選號數量快速增加，送單前請確認總額。</li>
        <li><strong>選號（彩池）</strong>是另一條獨立的池：固定選 3 碼、依命中顆數（3／2／1）分層派彩，
          與上面的賠率制玩法、爆池都是分開的帳。</li>
        <li><strong>爆池加碼</strong>與賠率派彩會合併在同一期的可領獎金裡，
          下注紀錄的派彩欄會另外標出加碼金額。</li>
      </ul>
    </section>

  </DialogShell>
</template>

<style scoped lang="scss">
/* 版面與 kl10 的遊戲說明同一套：每段落一張帶框的區塊卡片、紅底表頭的表格 */
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

  &#kl8-section-intro {
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
