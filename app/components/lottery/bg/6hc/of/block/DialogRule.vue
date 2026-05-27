<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  visible: boolean
  jackpot?: {
    issue: string
    currentIssueJackpot: number
    carryJackpot: number
  }
}>()

const totalPool = computed(() => {
  const j = props.jackpot
  if (!j) return 0
  return Number((Number(j.currentIssueJackpot ?? 0) + Number(j.carryJackpot ?? 0)).toFixed(2))
})

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

const prizeTiers = [
  { match: 7, ratioNum: 0.40, ratio: '40%', desc: '頭獎' },
  { match: 6, ratioNum: 0.20, ratio: '20%', desc: '二獎' },
  { match: 5, ratioNum: 0.15, ratio: '15%', desc: '三獎' },
  { match: 4, ratioNum: 0.10, ratio: '10%', desc: '四獎' },
  { match: 3, ratioNum: 0.08, ratio: '8%', desc: '五獎' },
  { match: 2, ratioNum: 0.07, ratio: '7%', desc: '六獎' },
]

const timeline = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒', status: '正在開獎中', desc: '隨機攪出 7 顆號碼' },
  { range: '6 分 15 秒 後', status: '已開獎', desc: '結算完成，可查閱結果' },
]

const playTypes = [
  {
    key: 'SINGLE',
    name: '自選單式',
    desc: '每注固定選取 7 顆號碼，一張注單對應一組選號。',
    example: '例：選 05、12、18、23、31、37、45 → 共 1 注'
  },
  {
    key: 'DUPLEX',
    name: '自選複式',
    desc: '選取多於 7 顆號碼，系統自動組合成多注（每注 7 顆）。',
    example: '例：選 8 顆 → 系統組合出 C(8,7) = 8 注'
  },
  {
    key: 'DANTUO',
    name: '自選膽拖',
    desc: '指定膽碼（必中號）＋拖碼，由系統排列組合成多注。',
    example: '例：1 膽 + 7 拖 → C(7,6) = 7 注'
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
            <li>從 <strong>01 — 49</strong> 共 49 顆號碼中，每期隨機攪出 <strong>7 顆</strong>（6 正碼＋1 特碼）。</li>
            <li>每日共 <strong>205 期</strong>，每 <strong>7 分鐘</strong> 開獎一次。</li>
            <li>玩家選取號碼下注，依命中球數對應不同獎級分配獎池。</li>
          </ul>
        </div>

        <!-- 每期時間流程 -->
        <div id="section-timeline" class="rule-section">
          <h4 class="rule-title">每期時間流程（共 7 分鐘）</h4>
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
          <p class="rule-note">以下比例為各獎級獲得的獎池份額，同獎級多人得獎則<strong>平均分配</strong>。</p>
          <div class="prize-pool-row" v-if="totalPool > 0">
            <span class="pool-label">當期總獎池</span>
            <span class="pool-value">{{ totalPool.toLocaleString('zh-TW', { minimumFractionDigits: 2 }) }} F幣</span>
          </div>
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
                  <th>命中球數</th>
                  <th>獎池占比</th>
                  <th>預估獎金（單人中獎）</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tier in prizeTiers" :key="tier.match" :class="{ 'tier-top': tier.match === 7 }">
                  <td class="tier-name">{{ tier.desc }}</td>
                  <td class="tier-match">{{ tier.match }} 顆</td>
                  <td class="tier-ratio">{{ tier.ratio }}</td>
                  <td class="tier-est">
                    <template v-if="totalPool > 0">
                      {{ (totalPool * tier.ratioNum).toLocaleString('zh-TW', { minimumFractionDigits: 2 }) }}
                    </template>
                    <span v-else class="tier-est-empty">—</span>
                  </td>
                  <td class="tier-hint">{{ tier.match === 7 ? '7 顆全中' : `開獎 7 顆中命中 ${tier.match} 顆` }}</td>
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
  .prize-pool-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;

    .pool-label {
      font-weight: 600;
      color: var(--color-red-desc);
    }

    .pool-value {
      font-weight: 700;
      font-size: 14px;
      color: #d97706;
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
