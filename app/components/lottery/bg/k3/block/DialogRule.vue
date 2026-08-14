<script setup lang="ts">
import { computed } from 'vue'
import DialogShell from '~/components/lottery/bg/k3/block/DialogShell.vue'
import { k3OddsOf, K3_SUM_COUNTS, K3_TOTAL_OUTCOMES, K3_BIG_LINE } from '#shared/config/k3-cd'
import { K3_DICE_COUNT, K3_DICE_MAX } from '#shared/config/k3'
import { K3_OF_PRIZE_TIERS, K3_OF_PICK_COUNT } from '#shared/config/k3-of'
import C_PLAYS from '#shared/config/k3cd/plays'
import { k3RtpOf, k3TabOddsOf } from '#shared/config/k3cd/helpers'
import { k3OgOddsOf, K3OG_TWO_SIDE_TOTAL } from '#shared/config/k3og'
import { k3OgPlays, k3OgRtpOf, k3OgTabOddsOf, k3OgComboOf } from '#shared/config/k3og/helpers'
import { useK3 } from '~/composables/useK3'

/**
 * 玩法說明
 * 賠率與機率一律由 config / k3-cd 推算，改設定就自動跟上（不寫死數字）
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

/**
 * 說明內容依當前盤口切換
 *
 * 兩個盤口的開獎號、彩池、時間流程都共用（那幾段兩邊一樣），但「投注玩法」與
 * 「獎金結構」是各自的 —— 在官方盤看到信用盤的注項表只會混淆，所以只列當前盤口的。
 */
const { isCd } = useK3()
const boardName = computed(() => (isCd.value ? '信用' : '官方'))

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

/** 上方快捷選單（同 6hc 的 .cd-rule-nav） */
const NAV_ITEMS = [
  { id: 'k3-section-intro', label: '遊戲簡介' },
  { id: 'k3-section-timeline', label: '時間流程' },
  { id: 'k3-section-play', label: '投注玩法' },
  { id: 'k3-section-prize', label: '獎金結構' },
  { id: 'k3-section-jackpot', label: '獎池滾存' },
  { id: 'k3-section-note', label: '特別說明' }
]

/** 每期 7 分鐘（與 6hc 共用 server lotteryBase 的 timer.getStatusBySeconds） */
const TIMELINE = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒 — 5 分 50 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒 — 6 分 00 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒 — 6 分 40 秒', status: '正在開獎中', desc: `擲出 ${K3_DICE_COUNT} 顆骰子` },
  { range: '6 分 40 秒 後', status: '已開獎', desc: '逐注結算派彩，可查閱結果' }
]

const click = {
  /** 快捷選單：捲到對應段落（scrollIntoView 會自己找捲動容器，不用接 DialogShell 的 ref） */
  scrollTo: (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/**
 * 官方盤賠率玩法的注項表（k3og）
 *
 * 與信用盤那張表同一個算法：賠率讀 helpers、命中機率由公平賠率反推。
 * 組合分頁（三不同號／二不同號）沒有固定注項清單，改列一組樣本注碼與規則。
 */
const OG_PLAY_ROWS = computed(() =>
  k3OgPlays().map((play) => ({
    key: String(play.key ?? ''),
    name: String(play.name ?? ''),
    tabs: (play.list ?? []).map((tab: any) => {
      const combo = k3OgComboOf(play.key, tab.tabId)
      const rtp = k3OgRtpOf(play.key, tab.tabId)
      if (combo) {
        const sample = `${combo.prefix}${Array.from({ length: combo.pick }, (_, i) => i + 1).join('')}`
        const odds = k3OgTabOddsOf(play.key, tab.tabId, sample)
        const fair = k3OgOddsOf(sample, 1)
        return {
          tabName: String(tab.tabName ?? ''),
          rtp,
          combo: {
            pick: combo.pick,
            mode: combo.mode,
            maxDan: combo.maxDan ?? combo.pick - 1,
            sample,
            odds,
            percent: fair > 0 ? (100 / fair).toFixed(4) : '—'
          },
          groups: []
        }
      }
      return {
        tabName: String(tab.tabName ?? ''),
        rtp,
        combo: null,
        groups: (tab.tabGroup ?? []).map((group: any) => ({
          groupName: String(group.groupName ?? ''),
          items: (group.groupList ?? []).map((item: any) => {
            const name = String(item?.name ?? '')
            const odds = k3OgTabOddsOf(play.key, tab.tabId, name)
            const fair = k3OgOddsOf(name, 1)
            return { name, odds, percent: fair > 0 ? (100 / fair).toFixed(4) : '—' }
          })
        }))
      }
    })
  }))
)

/** 各玩法的注項表（含命中機率，由公平賠率反推：機率 = 1 / 公平賠率） */
const PLAY_ROWS = computed(() =>
  (C_PLAYS as any[]).map((play) => ({
    key: play.key,
    name: play.name,
    tabs: play.list.map((tab: any) => ({
      tabName: tab.tabName,
      rtp: k3RtpOf(play.key, tab.tabId),
      groups: tab.tabGroup.map((group: any) => ({
        groupName: group.groupName,
        items: group.groupList.map((item: any) => {
          const odds = k3TabOddsOf(play.key, tab.tabId, String(item.name))
          const fair = k3OddsOf(String(item.name), 1)
          return {
            name: String(item.name),
            odds,
            // 公平賠率的倒數就是命中機率
            percent: fair > 0 ? (100 / fair).toFixed(4) : '—'
          }
        })
      }))
    }))
  }))
)

const sumRows = computed(() =>
  Object.keys(K3_SUM_COUNTS).map(Number).sort((a, b) => a - b).map((sum) => ({
    sum,
    count: K3_SUM_COUNTS[sum],
    percent: ((K3_SUM_COUNTS[sum]! / K3_TOTAL_OUTCOMES) * 100).toFixed(4)
  }))
)
</script>

<template>
  <DialogShell :visible="props.visible" :title="`遊戲說明 — 快3${boardName}玩法`" width="min(1100px, 96vw)"
    @close="emit('close')">
    <!-- 上方快捷選單（同 6hc 的 .cd-rule-nav） -->
    <nav class="rule-nav">
      <button v-for="item in NAV_ITEMS" :key="item.id" type="button" class="rule-nav-btn"
        @click="click.scrollTo(item.id)">
        {{ item.label }}
      </button>
    </nav>

    <section id="k3-section-intro" class="rule-sec">
      <h4>遊戲簡介</h4>
      <ul>
        <li>每期開出 <strong>{{ K3_DICE_COUNT }} 顆骰子</strong>，每顆 1 ~ {{ K3_DICE_MAX }} 點（可重複），
          共 {{ K3_DICE_MAX }}<sup>{{ K3_DICE_COUNT }}</sup> = <strong>{{ K3_TOTAL_OUTCOMES }}</strong> 種等機率結果。</li>
        <li>目前檢視的是<strong>快3 {{ boardName }}玩法</strong>。
          信用玩法每注獨立、按賠率派彩；官方玩法有 6 個賠率玩法，另有一個「選號」玩法
          選 {{ K3_OF_PICK_COUNT }} 個點數、依命中顆數分層從獎池分配。</li>
        <li>兩種玩法<strong>共用同一份開獎號與彩池</strong> —— 同一期的骰子必然相同，抽水也累積到同一個池。</li>
        <li>賠率一律由「公平賠率 × 回報率」推算（公平賠率 = {{ K3_TOTAL_OUTCOMES }} ÷ 該注項命中的結果數），
          不是拍板數字，因此每個注項的期望回報率一致。</li>
      </ul>
    </section>

    <section id="k3-section-timeline" class="rule-sec">
      <h4>時間流程（每期共 7 分鐘）</h4>
      <table class="report-table">
        <thead><tr><th>時間</th><th>狀態</th><th>說明</th></tr></thead>
        <tbody>
          <tr v-for="row in TIMELINE" :key="row.range">
            <td>{{ row.range }}</td>
            <td class="is-name">{{ row.status }}</td>
            <td>{{ row.desc }}</td>
          </tr>
        </tbody>
      </table>
      <p class="rule-note">※ 信用玩法與官方玩法共用同一份期表，同一期的時間點完全一致。</p>
    </section>

    <section class="rule-sec">
      <h4>和值分布（{{ K3_TOTAL_OUTCOMES }} 種結果窮舉）</h4>
      <table class="report-table">
        <thead><tr><th>和值</th><th v-for="row in sumRows" :key="row.sum">{{ row.sum }}</th></tr></thead>
        <tbody>
          <tr><td>組數</td><td v-for="row in sumRows" :key="row.sum">{{ row.count }}</td></tr>
          <tr><td>機率%</td><td v-for="row in sumRows" :key="row.sum">{{ row.percent }}</td></tr>
        </tbody>
      </table>
      <p class="rule-note">
        ※ 分布對稱：3↔18、4↔17 … 10↔11；中間的 10 / 11 各 {{ K3_SUM_COUNTS[10] }} 種最容易出現。
      </p>
    </section>

    <section class="rule-sec">
      <h4>大小單雙</h4>
      <ul>
        <li>和值 ≥ <strong>{{ K3_BIG_LINE }}</strong> 為大、≤ {{ K3_BIG_LINE - 1 }} 為小；和值奇數為單、偶數為雙。</li>
        <li><strong>開出圍骰（三顆同點）時大小單雙一律「和局」退還本金</strong>，
          因此機率母數是 {{ K3_TOTAL_OUTCOMES - K3_DICE_MAX }}（{{ K3_TOTAL_OUTCOMES }} − {{ K3_DICE_MAX }} 個圍骰），
          四個注項各 {{ (K3_TOTAL_OUTCOMES - K3_DICE_MAX) / 2 }} 種、公平賠率剛好 2.000。</li>
      </ul>
    </section>

    <h3 id="k3-section-play" class="rule-group-title">投注玩法 · 快3 {{ boardName }}玩法（賠率制）</h3>
    <section v-for="play in (isCd ? PLAY_ROWS : [])" :key="play.key" class="rule-sec">
      <h4>{{ play.name }}</h4>
      <div v-for="tab in play.tabs" :key="tab.tabName">
        <p class="rule-note">回報率 {{ (tab.rtp * 100).toFixed(0) }}%</p>
        <table v-for="group in tab.groups" :key="group.groupName" class="report-table rule-table">
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

    <section v-for="play in (isCd ? [] : OG_PLAY_ROWS)" :key="`og-${play.key}`" class="rule-sec">
      <h4>{{ play.name }}</h4>
      <div v-for="tab in play.tabs" :key="tab.tabName">
        <p class="rule-note">{{ tab.tabName }} · 回報率 {{ (tab.rtp * 100).toFixed(0) }}%</p>
        <!-- 組合分頁沒有固定注項清單，列規則與樣本注碼 -->
        <ul v-if="tab.combo">
          <li v-if="tab.combo.mode === 'standard'">
            從 1 ~ {{ K3_DICE_MAX }} 選 <strong>{{ tab.combo.pick }} 個以上</strong>不同點數，
            每 {{ tab.combo.pick }} 個一組成一注（選 n 個 → C(n,{{ tab.combo.pick }}) 注）。
          </li>
          <li v-else>
            <strong>膽碼</strong>每注必含（最多 {{ tab.combo.maxDan }} 個），
            再從<strong>拖碼</strong>補滿 {{ tab.combo.pick }} 個點數成一注。
          </li>
          <li>每一注的機率相同 —— 賠率 <strong>{{ tab.combo.odds }}</strong>、
            命中機率 {{ tab.combo.percent }}%（例：{{ tab.combo.sample }}）。</li>
        </ul>
        <table v-for="group in tab.groups" :key="group.groupName" class="report-table rule-table">
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

    <h3 id="k3-section-prize" class="rule-group-title">獎金結構</h3>
    <section v-if="isCd" class="rule-sec">
      <h4>信用玩法 · 賠率制派彩</h4>
      <ul>
        <li>每注獨立結算：<strong>派彩 = 下注金額 × 賠率</strong>（賠率含本金，中獎即依此金額入可領獎金）。</li>
        <li>賠率 = <strong>公平賠率 × 該分頁回報率</strong>，公平賠率 = {{ K3_TOTAL_OUTCOMES }} ÷ 該注項命中的結果數
          （兩面玩法的母數是 {{ K3OG_TWO_SIDE_TOTAL }}）。</li>
        <li>兩面玩法開出圍骰為<strong>和局</strong>，退還本金、不計輸贏。</li>
        <li>信用玩法的投注會抽水進共用彩池（見「獎池滾存」），但<strong>不從彩池派彩</strong>。</li>
      </ul>
    </section>

    <section v-else class="rule-sec">
      <h4>官方玩法 · 賠率制派彩（6 個玩法）</h4>
      <ul>
        <li>和值／三同號／三不同號／三連號／二同號／二不同號皆為<strong>固定賠率</strong>：
          派彩 = 下注金額 × 賠率（賠率含本金）。</li>
        <li>組合玩法（三不同號、二不同號）<strong>一組點數就是一注</strong>，各注獨立結算。</li>
      </ul>
    </section>

    <section v-if="!isCd" class="rule-sec">
      <h4>官方玩法 · 獎池分層（選號玩法）</h4>
      <ul>
        <li>一注選 <strong>{{ K3_OF_PICK_COUNT }} 個點數</strong>（可重複），
          命中數為<strong>多重集交集</strong> —— 每顆開獎骰子只能被配掉一次。
          例：選 2,2,4 開 2,4,4 → 命中 2 顆；選 2,2,2 開 2,3,4 → 命中 1 顆。</li>
      </ul>
      <table class="report-table">
        <thead><tr><th>命中</th><th>分層</th><th>派彩方式</th></tr></thead>
        <tbody>
          <tr v-for="tier in K3_OF_PRIZE_TIERS" :key="tier.name">
            <td>{{ tier.match }} 顆</td>
            <td class="is-name">{{ tier.name }}</td>
            <td>
              <template v-if="tier.type === 'pool'">
                彩池 {{ (tier.ratio * 100).toFixed(0) }}%，依下注額比例分配
                <em v-if="tier.minAmount">（每單位最低 {{ money(tier.minAmount) }}）</em>
              </template>
              <template v-else>固定 {{ tier.amount }} 倍</template>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="rule-note">※ 該層沒有中獎者時，該層獎金整塊滾存至下期。</p>
    </section>

    <section id="k3-section-jackpot" class="rule-sec">
      <h4>獎池滾存</h4>
      <ul>
        <li>兩個盤口的投注都會<strong>抽水進同一個彩池</strong>（信用玩法 2%、官方玩法 60%）。</li>
        <li>可發放獎金 =（<strong>池底</strong> + 該期抽水 × 0.8 + <strong>累積滾存</strong>）× 0.55 ——
          與 6hc 官方玩法同一條公式。</li>
        <li><strong>池底</strong>是系統隨機給的基礎獎金；被派發到低於頭獎最低保障時會重新產生一組。</li>
        <li>官方玩法的分層若<strong>該層沒有中獎者</strong>，該層獎金整塊<strong>滾存至下期</strong>，
          所以連續無人中獎時獎池會越積越大。</li>
        <li>畫面上的<strong>總獎金</strong>就是「本期實際可發放的金額」，
          <strong>預估頭獎</strong>＝總獎金 × 頭獎層比例，不是門面數字。</li>
      </ul>
    </section>

    <section id="k3-section-note" class="rule-sec">
      <h4>特別說明</h4>
      <ul>
        <li><strong>圍骰（三顆同點）在兩面判定為和局</strong>，退還本金 —— 大小單雙的機率母數因此是
          {{ K3OG_TWO_SIDE_TOTAL }} 而不是 {{ K3_TOTAL_OUTCOMES }}。</li>
        <li>官方玩法的<strong>二不同號</strong>採「兩個點數都出現即中」（含其中一個成對的情況），
          與信用玩法的長牌同一個定義。</li>
        <li>官方玩法的<strong>二同號複選</strong>是「該對子<strong>恰好</strong>出現兩顆」——
          開出圍骰不算中。</li>
        <li><strong>賠率在下注當下就鎖進注單</strong>，之後調整設定或回報率都不影響已成立的注單。</li>
        <li>兩個盤口的<strong>注單與可領獎金分開記錄</strong>，但<strong>開獎號與彩池共用</strong>。</li>
        <li>單注與單期限額由各分頁的設定決定，超限伺端會<strong>整筆拒單</strong>（不會只擋超出的部分）。</li>
      </ul>
    </section>
  </DialogShell>
</template>

<style scoped lang="scss">
/* 快捷選單（同 6hc 的 .cd-rule-nav —— 跟著內容捲走，不釘在上方） */
.rule-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  border: 1px solid #fee2e2;
  border-radius: 6px;
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

/* 大段標題（投注玩法／獎金結構），與段落標題 h4 區隔 */
.rule-group-title {
  margin: 18px 0 8px;
  border-bottom: 2px solid var(--color-red-main);
  padding-bottom: 4px;
  font-size: 16px;
  font-weight: 800;
  color: var(--color-red-main);

  &:first-of-type {
    margin-top: 8px;
  }
}

.rule-sec {
  margin-bottom: 16px;

  h4 {
    margin: 0 0 6px;
    border-left: 4px solid var(--color-red-main);
    padding-left: 8px;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-red-main);
  }

  ul {
    margin: 0 0 8px;
    padding-left: 1.2rem;

    li {
      font-size: 13px;
      line-height: 1.9;
      color: var(--color-red-desc);

      strong { color: var(--color-red-main); }
    }
  }

  .rule-note {
    margin: 6px 0;
    font-size: 12px;
    color: var(--color-red-desc);
  }

  .rule-table { margin-bottom: 8px; }

  :deep(.report-table) {
    .is-name { font-weight: 700; color: var(--color-red-main); }
    .is-odds { font-weight: 700; color: #d97706; }
    em { font-style: normal; color: #d97706; }
  }
}
</style>
