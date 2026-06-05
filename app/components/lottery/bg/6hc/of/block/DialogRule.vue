<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const { jackpotBase, livePool } = use6hcOfficial()

const totalPool = computed(() => livePool.value)

const emit = defineEmits<{
  close: []
}>()

const dialogEl = ref<HTMLElement | null>(null)

const navItems = [
  { id: 'section-intro', label: '遊戲簡介' },
  { id: 'section-timeline', label: '時間流程' },
  { id: 'section-play', label: '投注玩法' },
  { id: 'section-prize', label: '獎金結構' },
  { id: 'section-jackpot', label: '獎池滾存' },
  { id: 'section-note', label: '特別說明' },
]

function scrollToSection(id: string) {
  const container = dialogEl.value
  const target = container?.querySelector<HTMLElement>(`#${id}`)
  if (!container || !target) return
  const offset = target.offsetTop - container.offsetTop - 8
  container.scrollTo({ top: offset, behavior: 'smooth' })
}

// 開獎 7 顆：openCode[0..5]=正碼, openCode[6]=特別號；玩家每注選 6 顆
const prizeTiers = [
  { normalMatch: 6, needSpecial: false, type: 'pool' as const, ratioNum: 0.70, ratio: '70%', desc: '頭獎', probability: '1 / 1,398萬', hint: '6 個正碼全中｜每人最低 200,000' },
  { normalMatch: 5, needSpecial: true, type: 'pool' as const, ratioNum: 0.20, ratio: '20%', desc: '二獎', probability: '1 / 2,330,636', hint: '5 個正碼＋特別號｜每人最低 50,000' },
  { normalMatch: 5, needSpecial: false, type: 'pool' as const, ratioNum: 0.10, ratio: '10%', desc: '三獎', probability: '1 / 55,491', hint: '5 個正碼（不含特別號）｜每人最低 3,500' },
  { normalMatch: 4, needSpecial: true, type: 'fixed' as const, amount: 3000, desc: '四獎', probability: '1 / 22,196', hint: '4 個正碼＋特別號' },
  { normalMatch: 4, needSpecial: false, type: 'fixed' as const, amount: 200, desc: '五獎', probability: '1 / 1,082', hint: '4 個正碼（不含特別號）' },
  { normalMatch: 3, needSpecial: true, type: 'fixed' as const, amount: 10, desc: '六獎', probability: '1 / 812', hint: '3 個正碼＋特別號' },
  { normalMatch: 3, needSpecial: false, type: 'fixed' as const, amount: 5, desc: '七獎', probability: '約 1.64%', hint: '3 個正碼（不含特別號）' },
]

const timeline = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒', status: '正在開獎中', desc: '隨機攪出 7 顆號碼' },
  { range: '6 分 40 秒 後', status: '已開獎', desc: '結算完成，可查閱結果' },
]

const playTypes = [
  {
    key: 'SINGLE',
    name: '自選單式',
    desc: '每注固定選取 6 顆號碼，一張注單對應一組選號。',
    example: '例：選 05、12、18、23、31、37 → 共 1 注'
  },
  {
    key: 'DUPLEX',
    name: '自選複式',
    desc: '選取多於 6 顆號碼，系統自動組合成多注（每注 6 顆）。',
    example: '例：選 8 顆 → 系統組合出 C(8,6) = 28 注'
  },
  {
    key: 'DANTUO',
    name: '自選膽拖',
    desc: '指定膽碼（必中號）＋拖碼，由系統排列組合成多注。',
    example: '例：1 膽 + 6 拖 → C(6,5) = 6 注'
  },
]
</script>

<template>
  <div v-if="visible" class="rule-dialog-mask" @click.self="emit('close')">
    <section ref="dialogEl" class="rule-dialog">
      <header class="rule-dialog-header">
        <h3>遊戲說明 — 六合彩官方玩法</h3>
        <button type="button" class="close-btn" @click="emit('close')">×</button>
      </header>

      <nav class="rule-nav">
        <button v-for="item in navItems" :key="item.id" type="button" class="rule-nav-btn"
          @click="scrollToSection(item.id)">{{ item.label }}</button>
      </nav>

      <div class="rule-body">
        <!-- 遊戲簡介 -->
        <div id="section-intro" class="rule-section">
          <h4 class="rule-title">遊戲簡介</h4>
          <ul class="rule-list">
            <li>從 <strong>01 — 49</strong> 共 49 顆號碼中，每期隨機攪出 <strong>7 顆</strong>（6 正碼＋1 特別號）。</li>
            <li>每日共 <strong>205 期</strong>，每 <strong>7 分鐘</strong> 開獎一次。</li>
            <li>每注選取 <strong>6 顆</strong> 號碼，依命中正碼與特別號數量對應不同獎級。</li>
          </ul>
        </div>

        <!-- 每期時間流程 -->
        <div id="section-timeline" class="rule-section">
          <h4 class="rule-title">遊戲流程（共 7 分鐘）</h4>
          <div class="timeline-table-wrap">
            <table class="rule-table">
              <colgroup>
                <col style="width: 32%" />
                <col style="width: 22%" />
                <col style="width: 46%" />
              </colgroup>
              <thead>
                <tr>
                  <th>時間節點</th>
                  <th>狀態</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in timeline" :key="item.status">
                  <td class="td-range">{{ item.range }}</td>
                  <td>
                    <span class="status-badge" :class="`status-${item.status}`">{{ item.status }}</span>
                  </td>
                  <td>{{ item.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 玩法說明 -->
        <div id="section-play" class="rule-section">
          <h4 class="rule-title">投注玩法</h4>
          <div class="play-cards">
            <div v-for="play in playTypes" :key="play.key" class="play-card">
              <div class="play-card-name">{{ play.name }}</div>
              <p class="play-card-desc">{{ play.desc }}</p>
              <p class="play-card-example">{{ play.example }}</p>
            </div>
          </div>
        </div>

        <!-- 中獎分級 -->
        <div id="section-prize" class="rule-section">
          <h4 class="rule-title">獎金結構</h4>
          <p class="rule-note">
            頭/二/三獎為獎池制，依下注金額比例分配；<br>
            頭獎每人最低 200,000、二獎最低 50,000、三獎最低 3,500。<br>
            四至七獎為固定金額 × 注數。
          </p>
          <!-- <div class="prize-pool-rows" v-if="jackpotBase > 0 || totalPool > 0">
            <div class="prize-pool-row">
              <span class="pool-label">池底金額</span>
              <span class="pool-value pool-value-base">{{ jackpotBase.toLocaleString('zh-TW', {
                minimumFractionDigits:
                  2, maximumFractionDigits: 2
              }) }} F幣</span>
            </div>
            <div class="prize-pool-row">
              <span class="pool-label">當期投注額</span>
              <span class="pool-value pool-value-current">
                {{ (totalPool - jackpotBase).toLocaleString('zh-TW', {
                  minimumFractionDigits: 2, maximumFractionDigits:
                    2
                }) }} F幣
              </span>
            </div>
            <div class="prize-pool-row prize-pool-row-total">
              <span class="pool-label">當期總獎池</span>
              <span class="pool-value">{{ totalPool.toLocaleString('zh-TW', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }) }} F幣</span>
            </div>
          </div> -->
          <div class="prize-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 15%" />
                <col style="width: 15%" />
                <col style="width: 20%" />
                <col style="width: 25%" />
                <col style="width: 25%" />
              </colgroup>
              <thead>
                <tr>
                  <th>獎級</th>
                  <th>中獎條件</th>
                  <th>中獎機率</th>
                  <th>獎金金額（單人中獎）</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tier in prizeTiers" :key="`${tier.normalMatch}-${tier.needSpecial}`"
                  :class="{ 'tier-top': tier.normalMatch === 6 && !tier.needSpecial }">
                  <td class="tier-name">{{ tier.desc }}</td>
                  <td class="tier-match">{{ tier.needSpecial ? `${tier.normalMatch} 正＋特別` : `${tier.normalMatch} 正碼` }}
                  </td>
                  <td class="tier-ratio">{{ tier.probability }}</td>
                  <td class="tier-est">
                    <template v-if="tier.type === 'pool'">
                      <template v-if="totalPool > 0">
                        {{ Math.floor(totalPool * tier.ratioNum).toLocaleString('zh-TW') }}
                      </template>
                      <span v-else class="tier-est-empty">—</span>
                    </template>
                    <template v-else>
                      {{ tier.amount.toLocaleString('zh-TW') }}
                    </template>
                  </td>
                  <td class="tier-hint">{{ tier.hint }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 獎池與滾存 -->
        <div id="section-jackpot" class="rule-section">
          <h4 class="rule-title">獎池與滾存機制</h4>
          <ul class="rule-list">
            <li><strong>本期獎池</strong> = 當期所有玩家投注金額合計。</li>
            <li><strong>總獎池</strong> = 本期獎池 ＋ 前期累積滾存。</li>
            <li>頭獎占總獎池 <strong>70%</strong>、二獎 <strong>20%</strong>、三獎 <strong>10%</strong>。</li>
            <li>若某獎級<strong>無人中獎</strong>，該獎級對應比例自動滾存至下期。</li>
            <li>中獎金額需主動點選「<strong>領取中獎獎金</strong>」按鈕才可入帳。</li>
          </ul>
        </div>

        <!-- 特別說明 -->
        <div id="section-note" class="rule-section rule-section-last">
          <h4 class="rule-title">特別說明</h4>
          <ul class="rule-list">
            <li>封盤後送出的投注<strong>不予受理</strong>，請在開盤期間內完成下注。</li>
            <li>每注投注金額由玩家自行設定，總扣款 = 單注金額 × 注數。</li>
            <li>開獎結果以系統公布為準，如對結果有疑問請聯繫客服。</li>
          </ul>
        </div>
      </div>

      <button type="button" class="back-top-btn" @click="dialogEl?.scrollTo({ top: 0, behavior: 'smooth' })">↑
        TOP</button>
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
  background: #fff;
  border-radius: 8px;
  border: 4px solid var(--color-red-black-btn);
  padding: 0.75rem;

  .rule-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    // margin-bottom: 14px;
    padding: 8px 10px;
    background: #fff5f6;
    border: 1px solid #fee2e2;
    border-bottom: unset;
    border-radius: 6px 6px 0 0;
  }

  .rule-nav-btn {
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-red-main);
    background: #fff;
    border: 1px solid #f2b7c1;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;

    &:hover {
      background: var(--color-red-main);
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
      color: var(--color-red-main);
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
      color: var(--color-red-desc);
      line-height: 1;

      &:hover {
        color: var(--color-red-main);
      }
    }
  }

  .rule-body {
    display: grid;
    gap: 18px;
  }

  .rule-section {
    border: 1px solid #fee2e2;
    border-radius: 6px;
    padding: 12px 14px;

    &#section-intro {
      border-radius: 0 0 6px 6px;
    }

    &.rule-section-last {
      margin-bottom: 4px;
    }
  }

  .rule-title {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main);
    border-left: 3px solid var(--color-red-main);
    padding-left: 8px;
  }

  .rule-note {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--color-red-desc);
  }

  .rule-list {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 5px;
    font-size: 13px;
    color: #374151;
    line-height: 1.55;

    strong {
      color: var(--color-red-main);
    }
  }

  // 表格共用
  .rule-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;

    thead th {
      background: var(--color-red-main);
      color: #fff;
      font-weight: 600;
      padding: 6px 8px;
      text-align: center;
      white-space: nowrap;
    }

    tbody td {
      padding: 6px 8px;
      text-align: center;
      border-bottom: 1px solid #fee2e2;
      color: #374151;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    tbody tr:hover td {
      background: #fff5f6;
    }
  }

  // 時間流程
  .timeline-table-wrap {
    overflow-x: auto;
  }

  .td-range {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-weight: 600;
    color: var(--color-red-desc);
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

  // 玩法卡片
  .play-cards {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  .play-card {
    border: 1px solid #f3b7bf;
    border-radius: 6px;
    padding: 10px 12px;
    background: #fff5f6;

    .play-card-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-main);
      margin-bottom: 6px;
    }

    .play-card-desc {
      margin: 0 0 4px;
      font-size: 12px;
      color: #374151;
      line-height: 1.5;
    }

    .play-card-example {
      margin: 0;
      font-size: 11px;
      color: var(--color-red-desc);
      font-style: italic;
    }
  }

  // 中獎分級
  .prize-pool-rows {
    display: grid;
    gap: 4px;
    margin-bottom: 10px;
    padding: 8px 10px;
    background: #fffbf0;
    border: 1px solid #fde68a;
    border-radius: 6px;
  }

  .prize-pool-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;

    .pool-label {
      font-weight: 600;
      color: var(--color-red-desc);
    }

    .pool-value {
      font-weight: 700;
      font-size: 13px;
      color: #d97706;

      &.pool-value-base {
        color: #6b7280;
        font-weight: 600;
      }

      &.pool-value-current {
        color: #15803d;
      }
    }

    &.prize-pool-row-total {
      margin-top: 4px;
      padding-top: 6px;
      border-top: 1px dashed #fde68a;

      .pool-label {
        font-size: 13px;
        color: var(--color-red-main);
      }

      .pool-value {
        font-size: 15px;
        color: var(--color-red-main);
      }
    }
  }

  .prize-table-wrap {
    overflow-x: auto;
  }

  .prize-table {
    .tier-top td {
      background: #fff8ed;
    }

    .tier-name {
      font-weight: 700;
      color: var(--color-red-main);
    }

    .tier-match {
      font-weight: 600;
    }

    .tier-ratio {
      font-weight: 700;
      font-size: 14px;
      color: #d97706;

      .tier-ratio-fixed {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
      }
    }

    .tier-est {
      font-weight: 700;
      font-size: 13px;
      color: #15803d;
    }

    .tier-est-empty {
      color: #9ca3af;
      font-weight: 400;
    }

    .tier-hint {
      font-size: 11px;
      color: #6b7280;
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
    background: var(--color-red-main);
    border: none;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    transition: opacity 0.15s;

    &:hover {
      opacity: 0.85;
    }
  }
}
</style>
