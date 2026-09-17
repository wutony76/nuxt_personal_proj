<script setup lang="ts">
import { ref } from 'vue'

/**
 * 比照 D539 的 DialogRule.vue 結構（頂部快捷導覽 + 分段 + 回頂部），內容改寫為 39樂合彩實際規則：
 * 01–39 選 2/3/4 個（二合/三合/四合）、全中才中獎、每天（週一至週六）開獎（跟今彩539同期）、每注 25 元。
 * 與 DLT/D539 一樣沒有彩池／自建賠率，開獎號碼與派彩金額完全鏡射台灣彩券官方 39樂合彩
 * （見 openspec/changes/add-tw-lottery-suite/design.md Decision 1、3）。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const dialogEl = ref<HTMLElement | null>(null)

const navItems = [
  { id: 'section-intro', label: '遊戲簡介' },
  { id: 'section-timeline', label: '開獎流程' },
  { id: 'section-play', label: '投注玩法' },
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

const timeline = [
  { range: '開獎日 20:00 前', status: '開盤中', desc: '可投注區間' },
  { range: '開獎日 20:00', status: '已封盤', desc: '停止接受投注' },
  { range: '開獎日 20:30', status: '正在開獎中', desc: '台灣彩券官方公開攪珠開獎（與今彩539同時）' },
  { range: '開獎後', status: '結算中', desc: '等待官方公布完整開獎號與獎金明細，本站據此結算' },
  { range: '結算完成', status: '已開獎', desc: '可在「我的紀錄」查看中獎明細並領獎' }
]

const prizeTiers = [
  { name: '二合', match: '選 2 個號碼，全部落在開獎號碼中' },
  { name: '三合', match: '選 3 個號碼，全部落在開獎號碼中' },
  { name: '四合', match: '選 4 個號碼，全部落在開獎號碼中' }
]
</script>

<template>
  <div v-if="visible" class="rule-dialog-mask" @click.self="emit('close')">
    <section ref="dialogEl" class="rule-dialog taiwan-lottery-scrollbar">
      <header class="rule-dialog-header">
        <h3>玩法說明 — 39樂合彩（官方鏡射玩法）</h3>
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
            <li>先選「玩幾合」——<strong>二合／三合／四合</strong>，再從 <strong>01 — 39</strong> 選滿對應數量（<strong>2／3／4 個</strong>）不重複號碼為一組，每組固定 <strong>25 coin</strong>。</li>
            <li>開獎後，只要這組選的號碼<strong>全部</strong>落在當期開出的號碼裡就中獎；<strong>沒有部分對中的獎項</strong>（是二元的中／不中，不是「對中幾個算第幾獎」）。</li>
            <li>39樂合彩<strong>跟隨今彩539開獎號碼</strong>（當期今彩539 5 個號碼、<strong>不含特別號</strong>）；一次送單最多可填 <strong>A ~ E 共 5 組</strong>，每組各自選合數與號碼、各自獨立判定與派彩，<strong>不是複式</strong>。</li>
            <li><strong>開獎號碼與各合數的派彩金額，完全鏡射台灣彩券官方 39樂合彩當期實際結果</strong>，本站不自建隨機開獎、不自建賠率公式、不做彩池。</li>
          </ul>
        </div>

        <!-- 開獎流程 -->
        <div id="section-timeline" class="rule-section">
          <h4 class="rule-title">開獎流程</h4>
          <p class="rule-note">比照官方：<strong>每天（週一至週六）開獎（跟今彩539同一時間）</strong>。</p>
          <div class="timeline-table-wrap">
            <table class="rule-table">
              <colgroup>
                <col style="width: 26%" />
                <col style="width: 20%" />
                <col style="width: 54%" />
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

        <!-- 投注玩法 -->
        <div id="section-play" class="rule-section">
          <h4 class="rule-title">投注玩法</h4>
          <p class="rule-note">
            每組先在上方切「二合／三合／四合」，決定要選幾個號碼，再從 01–39 圈選對應數量；A ~ E 最多 5 組，
            每組各自 25 coin。下注當下不會顯示獎金金額，要等官方開獎、本站完成結算後，才會在「我的紀錄」顯示實際派彩。
          </p>
        </div>

        <!-- 中獎條件 -->
        <div id="section-prize" class="rule-section">
          <h4 class="rule-title">中獎條件</h4>
          <div class="prize-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 30%" />
                <col style="width: 70%" />
              </colgroup>
              <thead>
                <tr>
                  <th>玩法</th>
                  <th>中獎條件</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tier in prizeTiers" :key="tier.name" :class="{ 'tier-top': tier.name === '四合' }">
                  <td class="tier-name">{{ tier.name }}</td>
                  <td class="tier-match">{{ tier.match }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 特別說明 -->
        <div id="section-note" class="rule-section rule-section-last">
          <h4 class="rule-title">特別說明</h4>
          <ul class="rule-list">
            <li>切換合數（二合／三合／四合）時，該組已選的號碼會清空，需重新選滿對應數量。</li>
            <li>封盤後送出的投注<strong>不予受理</strong>，請在開盤期間內完成下注。</li>
            <li>官方開獎後本站需等待官方公布完整開獎號與獎金明細才結算，可能需要一些時間，結算完成前注單會顯示「結算中」。</li>
            <li>中獎金額需主動點選「<strong>領取中獎獎金</strong>」按鈕才可入帳。</li>
            <li>開獎結果與獎金明細以台灣彩券官方公告為準，如對結果有疑問請聯繫客服。</li>
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

      &:hover {
        color: var(--color-accent-700, #8c491a);
      }
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
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
    border-left: 3px solid var(--color-accent-700, #8c491a);
    padding-left: 8px;
  }

  .rule-note {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);

    strong {
      color: var(--color-accent-700, #8c491a);
    }
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
      color: var(--color-accent-700, #8c491a);
    }
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

    tbody tr:last-child td {
      border-bottom: none;
    }

    tbody tr:hover td {
      background: var(--color-accent-100, #fff2eb);
    }
  }

  .timeline-table-wrap,
  .prize-table-wrap {
    overflow-x: auto;
  }

  .td-range {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-weight: 600;
    color: var(--color-neutral-700, #645c50);
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
      background: var(--color-neutral-300, #dcd3c4);
      color: var(--color-accent-700, #8c491a);
    }

    &.status-已封盤 {
      background: #f3f4f6;
      color: #6b7280;
    }

    &.status-結算中 {
      background: #fef3c7;
      color: #b45309;
    }
  }

  .prize-table {
    .tier-top td {
      background: #fff8ed;
    }

    .tier-name {
      font-weight: 700;
      color: var(--color-accent-700, #8c491a);
    }

    .tier-match {
      font-weight: 600;
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

    &:hover {
      opacity: 0.85;
    }
  }
}
</style>
