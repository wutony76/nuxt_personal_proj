<script setup lang="ts">
import { ref } from 'vue'
import { P4_BET_AMOUNT } from '#shared/config/p4'

/**
 * 比照 P3/M649/D539 的 DialogRule.vue 結構（頂部快捷導覽 + 分段 + 回頂部），內容改寫為 4星彩實際規則：
 * 0000–9999 四位數字（可重複），正彩/組彩，每天（週一至週六）20:30 開獎，每注 25 元。
 * 與 P3 不同：4星彩官方規則沒有「對彩」，本頁不提對彩；組彩排列分級改為「4 碼互異／有任何重複」
 * 二元分級（見 shared/config/p4.ts 的假設說明，本頁中獎條件表也會標註這是延伸自 P3 的假設）。
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
  { range: '開獎日 20:30', status: '正在開獎中', desc: '台灣彩券官方公開攪珠開獎' },
  { range: '開獎後', status: '結算中', desc: '等待官方公布完整開獎號與獎金明細，本站據此結算' },
  { range: '結算完成', status: '已開獎', desc: '可在「我的紀錄」查看中獎明細並領獎' }
]

const prizeTiers = [
  { name: '正彩', match: '4 位數字與開獎號碼「逐位對應」完全相同（頭獎，金額鏡射官方）' },
  { name: '組彩（4 碼互異）', match: '4 位數字與開獎號碼相同、不計順序（二獎，金額鏡射官方）' },
  { name: '組彩（有任何重複）', match: '含一對相同／兩對相同／三同一異，數字相同、順序不同（三獎，金額鏡射官方，本站將這些重複模式合併為同一獎項，見「特別說明」）' }
]
</script>

<template>
  <div v-if="visible" class="rule-dialog-mask" @click.self="emit('close')">
    <section ref="dialogEl" class="rule-dialog taiwan-lottery-scrollbar">
      <header class="rule-dialog-header">
        <h3>玩法說明 — 4星彩（官方鏡射玩法）</h3>
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
            <li>投注 <strong>4 位數字（0000 — 9999，每位 0~9，可重複）</strong>，每組固定 <strong>{{ P4_BET_AMOUNT }} coin</strong>，
              可選「正彩」「組彩」其中一種下注方式。</li>
            <li><strong>正彩</strong>：投注數字與開獎號碼逐位對應完全相同才中獎（頭獎）。</li>
            <li><strong>組彩</strong>：投注數字與開獎號碼「數字相同、順序不同」也算中獎——4 碼互異中二獎、有任何重複（一對相同／
              兩對相同／三同一異）中三獎；<strong>豹子（4 碼全同）不可下組彩</strong>（沒有組彩意義）。</li>
            <li>一次送單最多可填 <strong>A ~ E 共 5 組</strong>，每組各自選下注方式與數字、各自獨立判定與派彩，<strong>不是複式</strong>。</li>
            <li><strong>正彩／組彩的派彩金額，完全鏡射台灣彩券官方 4星彩當期實際結果</strong>；4星彩官方規則<strong>沒有對彩</strong>
              （3星彩才有），本頁不提供對彩玩法。</li>
          </ul>
        </div>

        <!-- 開獎流程 -->
        <div id="section-timeline" class="rule-section">
          <h4 class="rule-title">開獎流程</h4>
          <p class="rule-note">比照官方：<strong>每天開獎（週一至週六），週日不開獎</strong>。</p>
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
            每組先在上方切換「正彩／組彩」，再逐位（千/百/十/個）填入 0~9 數字；A ~ E 最多 5 組，
            每組各自 {{ P4_BET_AMOUNT }} coin。正彩／組彩下注當下不會顯示獎金金額，要等官方開獎、本站完成結算後，
            才會在「我的紀錄」顯示實際派彩。
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
                <tr v-for="tier in prizeTiers" :key="tier.name" :class="{ 'tier-top': tier.name === '正彩' }">
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
            <li>切換下注方式（正彩／組彩）時，該組已選的數字會清空，需重新填滿 4 位數字。</li>
            <li>組彩注碼 4 碼全同（豹子，例如 1111）會被拒絕下注，因為沒有「組彩」意義。</li>
            <li>
              官方 4星彩只提供「二獎」「三獎」2 個組彩獎項欄位，但 4 位數字的重複模式其實更細
              （4 碼互異／恰一對相同其餘相異／兩對相同／三同一異／四同）。本站延伸 3星彩「投注數字是否
              有重複」的判定原則，把「4 碼互異」對應二獎、「其餘有重複的模式」全部併入同一個三獎——
              <strong>這是延伸既有判定原則的假設，並非官方逐模式公告的規則</strong>，如需更細緻的分級，
              請留意台灣彩券官方公告是否日後開放更多獎項欄位。
            </li>
            <li>封盤後送出的投注<strong>不予受理</strong>，請在開盤期間內完成下注。</li>
            <li>官方開獎後本站需等待官方公布完整開獎號與獎金明細才結算正彩／組彩，可能需要一些時間，結算完成前注單會顯示「結算中」。</li>
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
