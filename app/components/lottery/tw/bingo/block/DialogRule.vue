<script setup lang="ts">
import { ref } from 'vue'
import {
  BINGO_BET_UNIT,
  BINGO_STAR_PAYOUT,
  BINGO_SUPER_NUMBER_PRIZE,
  BINGO_BIG_SMALL_PRIZE,
  BINGO_ODD_EVEN_PRIZE,
  BINGO_STAR_MIN,
  BINGO_STAR_MAX
} from '#shared/config/bingo'

/**
 * 比照 P3/P4 的 DialogRule.vue 結構（頂部快捷導覽 + 分段 + 回頂部），內容改寫為賓果賓果實際規則：
 * 01–80 選 20 開，每 5 分鐘一期，4 種投注類型（基本玩法/超級獎號/猜大小/猜單雙）皆為官方公開固定賠率，
 * 不查官方 API（官方沒有中獎明細端點，見 openspec/changes/add-tw-lottery-suite/design.md Decision 6）。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const dialogEl = ref<HTMLElement | null>(null)

const navItems = [
  { id: 'section-intro', label: '遊戲簡介' },
  { id: 'section-timeline', label: '開獎流程' },
  { id: 'section-prize', label: '中獎條件' },
  { id: 'section-note', label: '特別說明' }
]

function scrollToSection(id: string) {
  const container = dialogEl.value
  const target = container?.querySelector<HTMLElement>(`#${id}`)
  if (!container || !target) return
  const offset = target.offsetTop - container.offsetTop - 8
  container.scrollTo({ top: offset, behavior: 'smooth' })
}

const starRows = Array.from({ length: BINGO_STAR_MAX - BINGO_STAR_MIN + 1 }, (_, i) => {
  const star = BINGO_STAR_MIN + i
  const table = BINGO_STAR_PAYOUT[star] ?? {}
  const hits = Object.keys(table).map(Number).sort((a, b) => b - a)
  return { star, text: hits.map((hit) => `中${hit}中${table[hit]}元`).join('／') }
})
</script>

<template>
  <div v-if="visible" class="rule-dialog-mask" @click.self="emit('close')">
    <section ref="dialogEl" class="rule-dialog taiwan-lottery-scrollbar">
      <header class="rule-dialog-header">
        <h3>玩法說明 — 賓果賓果（官方鏡射開獎，固定賠率）</h3>
        <button type="button" class="close-btn" @click="emit('close')">×</button>
      </header>

      <nav class="rule-nav">
        <button v-for="item in navItems" :key="item.id" type="button" class="rule-nav-btn"
          @click="scrollToSection(item.id)">{{ item.label }}</button>
      </nav>

      <div class="rule-body">
        <div id="section-intro" class="rule-section">
          <h4 class="rule-title">遊戲簡介</h4>
          <ul class="rule-list">
            <li>每期從 <strong>01–80</strong> 開出 <strong>20 個號碼</strong>，每 <strong>5 分鐘</strong>連續開一期，沒有「星期幾開獎」的日曆概念。</li>
            <li><strong>基本玩法</strong>：選星數（1~10）並選滿對應個數的號碼，依「這幾個號碼中對中幾個」查官方公開固定賠率表，每注 {{ BINGO_BET_UNIT }} 元。</li>
            <li><strong>超級獎號</strong>：選 1 個號碼，猜中「第 20 個開出的號碼」，固定獎金 {{ BINGO_SUPER_NUMBER_PRIZE }} 元；
              <strong>獨立加購項目</strong>，額外 {{ BINGO_BET_UNIT }} 元，不含在基本玩法金額內。</li>
            <li><strong>猜大小／猜單雙</strong>：直接讀官方欄位比對，固定獎金各 {{ BINGO_BIG_SMALL_PRIZE }}／{{ BINGO_ODD_EVEN_PRIZE }} 元；
              和局（官方回傳「－」）<strong>退款</strong>，不算輸也不算贏。</li>
            <li>一次送單可<strong>混合</strong>以上 4 種投注類型，各自獨立計價、獨立判定、獨立派彩，互不影響。</li>
            <li>官方沒有中獎明細查詢端點，本站賠率表為<strong>官方公開固定金額</strong>，不自建賠率公式。</li>
          </ul>
        </div>

        <div id="section-timeline" class="rule-section">
          <h4 class="rule-title">開獎流程</h4>
          <p class="rule-note">每 5 分鐘一期，<strong>下注開放到開獎那一刻為止</strong>，沒有跨日的「已封盤」等待。</p>
          <table class="rule-table">
            <thead><tr><th>時間節點</th><th>說明</th></tr></thead>
            <tbody>
              <tr><td>開獎前</td><td>開盤中，可投注</td></tr>
              <tr><td>整點開獎</td><td>台灣彩券官方公開攪珠開獎</td></tr>
              <tr><td>開獎後</td><td>等待官方公布本期開獎資料，本站據此結算（結算中）</td></tr>
              <tr><td>結算完成</td><td>可在「我的紀錄」查看中獎明細並領取獎金／退款</td></tr>
            </tbody>
          </table>
        </div>

        <div id="section-prize" class="rule-section">
          <h4 class="rule-title">中獎條件（官方公開固定賠率，每注 {{ BINGO_BET_UNIT }} 元）</h4>
          <table class="rule-table prize-table">
            <thead><tr><th>星數</th><th>對中獎金</th></tr></thead>
            <tbody>
              <tr v-for="row in starRows" :key="row.star"><td class="tier-name">{{ row.star }} 星</td><td>{{ row.text }}</td></tr>
              <tr><td class="tier-name">超級獎號</td><td>猜中第 20 個開出的號碼：{{ BINGO_SUPER_NUMBER_PRIZE }} 元（加購 {{ BINGO_BET_UNIT }} 元／注）</td></tr>
              <tr><td class="tier-name">猜大小</td><td>猜中：{{ BINGO_BIG_SMALL_PRIZE }} 元；和局退款</td></tr>
              <tr><td class="tier-name">猜單雙</td><td>猜中：{{ BINGO_ODD_EVEN_PRIZE }} 元；和局退款</td></tr>
            </tbody>
          </table>
        </div>

        <div id="section-note" class="rule-section rule-section-last">
          <h4 class="rule-title">特別說明</h4>
          <ul class="rule-list">
            <li>超級獎號判定的是「所選號碼＝第 20 個開出的號碼」，不是「有在 20 個開出號碼的集合裡」——選中前 19 個開出的號碼並不會中超級獎號。</li>
            <li>猜大小／猜單雙若官方判定和局，注碼原額退還，退款與中獎獎金一樣需點選「領取」才會入帳。</li>
            <li>封盤（開獎當下）後送出的投注<strong>不予受理</strong>，請把握開盤期間下注。</li>
            <li>官方開獎後本站需等待官方公布本期資料才結算，可能需要一些時間，結算完成前注單會顯示「待開獎」。</li>
            <li>開獎結果以台灣彩券官方公告為準，如對結果有疑問請聯繫客服。</li>
          </ul>
        </div>
      </div>

      <button type="button" class="back-top-btn" @click="dialogEl?.scrollTo({ top: 0, behavior: 'smooth' })">↑ TOP</button>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.rule-dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.rule-dialog {
  width: min(760px, 96vw);
  max-height: 88vh;
  overflow: auto;
  background: var(--color-neutral-100, #f9f4ed);
  border-radius: 8px;
  border: 4px solid var(--color-accent-700, #8c491a);
  padding: 0.75rem;

  .rule-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
    background: #8c491a;
    border: 1px solid var(--color-accent-800, #643312);
    border-bottom: unset;
    border-radius: 6px 6px 0 0;
    box-shadow: var(--shadow-sm);
  }

  .rule-nav-btn {
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-accent-700, #8c491a);
    background: var(--color-neutral-100, #f9f4ed);
    border: 1px solid var(--color-accent-100, #fff2eb);
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

    &:hover {
      background: var(--color-accent-800, #643312);
      border-color: var(--color-accent-800, #643312);
      color: #fff;
    }
  }

  .rule-dialog-header {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 14px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      font-family: var(--font-heading);
      color: var(--color-accent-700, #8c491a);
    }

    .close-btn {
      font-size: 25px;
      font-weight: 700;
      position: absolute;
      top: -3px;
      right: 5px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-neutral-700, #645c50);
      line-height: 1;

      &:hover { color: var(--color-accent-700, #8c491a); }
    }
  }

  .rule-body {
    display: grid;
    gap: 18px;
  }

  .rule-section {
    border: 1px solid var(--color-neutral-300, #dcd3c4);
    border-radius: 6px;
    padding: 12px 14px;

    &#section-intro { border-radius: 0 0 6px 6px; }

    &.rule-section-last { margin-bottom: 4px; }
  }

  .rule-title {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
    border-left: 3px solid var(--color-accent-700, #8c491a);
    padding-left: 8px;
  }

  .rule-note {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);

    strong { color: var(--color-accent-700, #8c491a); }
  }

  .rule-list {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 5px;
    font-size: 13px;
    color: #374151;
    line-height: 1.55;

    strong { color: var(--color-accent-700, #8c491a); }
  }

  .rule-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;

    thead th {
      background: var(--color-accent-700, #8c491a);
      color: #fff;
      font-weight: 600;
      padding: 6px 8px;
      text-align: center;
      white-space: nowrap;
    }

    tbody td {
      padding: 6px 8px;
      text-align: center;
      border-bottom: 1px solid var(--color-neutral-300, #dcd3c4);
      color: #374151;
    }

    tbody tr:last-child td { border-bottom: none; }

    tbody tr:hover td { background: var(--color-accent-100, #fff2eb); }
  }

  .prize-table {
    .tier-name {
      font-weight: 700;
      color: var(--color-accent-700, #8c491a);
      white-space: nowrap;
    }
  }

  .back-top-btn {
    position: sticky;
    bottom: 12px;
    left: 100%;
    display: block;
    width: fit-content;
    margin-top: 10px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    background: var(--color-accent-700, #8c491a);
    border: none;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    transition: opacity 0.15s;

    &:hover { opacity: 0.85; }
  }
}
</style>
