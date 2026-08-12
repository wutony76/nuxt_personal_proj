<script setup lang="ts">
import { computed } from 'vue'
import DialogShell from '~/components/lottery/bg/k3/block/DialogShell.vue'
import { k3OddsOf, K3_SUM_COUNTS, K3_TOTAL_OUTCOMES, K3_BIG_LINE } from '#shared/config/k3-cd'
import { K3_DICE_COUNT, K3_DICE_MAX } from '#shared/config/k3'
import { K3_OF_PRIZE_TIERS, K3_OF_PICK_COUNT } from '#shared/config/k3-of'
import C_PLAYS from '#shared/config/k3cd/plays'
import { k3RtpOf, k3TabOddsOf } from '#shared/config/k3cd/helpers'

/**
 * 玩法說明
 * 賠率與機率一律由 config / k3-cd 推算，改設定就自動跟上（不寫死數字）
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

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
  <DialogShell :visible="props.visible" title="快3 玩法說明" width="min(1100px, 96vw)" @close="emit('close')">
    <section class="rule-sec">
      <h4>遊戲簡介</h4>
      <ul>
        <li>每期開出 <strong>{{ K3_DICE_COUNT }} 顆骰子</strong>，每顆 1 ~ {{ K3_DICE_MAX }} 點（可重複），
          共 {{ K3_DICE_MAX }}<sup>{{ K3_DICE_COUNT }}</sup> = <strong>{{ K3_TOTAL_OUTCOMES }}</strong> 種等機率結果。</li>
        <li><strong>信用玩法</strong>每注獨立、按賠率派彩；<strong>官方玩法</strong>選 {{ K3_OF_PICK_COUNT }} 個點數，
          依命中顆數分層從獎池分配。</li>
        <li>兩種玩法<strong>共用同一份開獎號與彩池</strong> —— 同一期的骰子必然相同，抽水也累積到同一個池。</li>
        <li>賠率一律由「公平賠率 × 回報率」推算（公平賠率 = {{ K3_TOTAL_OUTCOMES }} ÷ 該注項命中的結果數），
          不是拍板數字，因此每個注項的期望回報率一致。</li>
      </ul>
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

    <section v-for="play in PLAY_ROWS" :key="play.key" class="rule-sec">
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

    <section class="rule-sec">
      <h4>官方玩法 · 獎池分層</h4>
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
  </DialogShell>
</template>

<style scoped lang="scss">
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
