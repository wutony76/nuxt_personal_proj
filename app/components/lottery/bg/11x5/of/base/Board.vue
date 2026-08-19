<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/bg/11x5/base/Ball.vue'
import { useX5 } from '~/composables/useX5'

/**
 * 11選5 官方盤投注看板
 *
 * 完全由 shared/config/x5of/plays.js 驅動，本元件不認得任何玩法名稱，
 * 只依該分頁的 `combo.mode` 決定畫哪一種選號介面（四種）：
 *
 *   1. list   —— combo = null（定位膽／不定位／趣味玩法）
 *                注項清單，逐項可填金額（版面與信用盤看板同一套）
 *   2. single —— combo.mode = 'single'（直選／組選／任選單式）
 *                注碼由 conf **全部列出來**讓玩家直接點（不是文字輸入框），
 *                990 注會分頁顯示，避免一次畫太多按鈕
 *   3. picks  —— direct / group / any：每格一排號碼球，多選後展開成多注
 *   4. dantuo —— 膽碼 + 拖碼兩格；同號不可兩邊都選、膽碼上限為「目標碼數 − 1」
 *
 * ⚠️ 彩池分頁（後三直選）沒有固定賠率 —— 賠率欄改標「彩池」並列出分層說明，
 *    但選號與送單流程與其他分頁完全一樣（只有派彩方式不同）。
 */
const {
  state: mxState,
  of: mxOf,
  ofCombo,
  ofIsSingle,
  ofIsPool,
  ofPrizeTiers,
  ofItemGroups,
  ofComboGroups,
  ofSingleCodes,
  ofSingleAllCodes,
  ofSinglePageCount,
  ofExpandedCodes,
  ofRawComboCount,
  ofComboHint,
  ofQuota,
  ofSelectedCount,
  actions: mxActions
} = useX5()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const minCoin = computed(() => ofQuota.value.item.min)
const maxCoin = computed(() => ofQuota.value.item.max)

/** 當前分頁要畫哪一種選號介面 */
const layoutMode = computed(() => {
  if (!ofCombo.value) return 'list'
  if (ofIsSingle.value) return 'single'
  return ofCombo.value.mode === 'dantuo' ? 'dantuo' : 'picks'
})

const _handlers = {
  /**
   * 注碼的顯示文字：把該分頁共用的前綴削掉
   * 前綴（前三直選／任選三中三…）已經寫在分頁名稱上，格子裡再重複一次會很擠。
   * 削完把號碼每兩位插一個空白，`010203` → `01 02 03`，比較好讀。
   */
  shortOf: (code: string) => {
    const prefix = String(ofCombo.value?.prefix ?? '')
    const rest = prefix && code.startsWith(prefix) ? code.slice(prefix.length) : code
    if (!/^\d+$/.test(rest)) return rest || code
    return (rest.match(/\d{2}/g) ?? [rest]).join(' ')
  },
  /** 單選分頁的注項顯示文字（削掉群組名稱，例：群組「第一球」＋注碼「第一球07」→ 07） */
  shortItemOf: (name: string, groupName: string) => {
    if (groupName && name.startsWith(groupName)) return name.slice(groupName.length) || name
    // 不定位／趣味玩法的注碼前綴不等於群組名，改用固定前綴表削
    for (const prefix of [/^[前中後]三不定位/, /^猜中位/, /^定單雙/]) {
      if (prefix.test(name)) return name.replace(prefix, '') || name
    }
    return name
  },
  /** 該注項是不是純數字（決定畫號碼球還是文字膠囊） */
  isNumeric: (text: string) => /^\d{1,2}$/.test(text)
}

const click = {
  /** 單選／單式：點注碼切換選取 */
  code: (code: string) => mxActions.toggleOfItem(code),
  codeCoin: (code: string, event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(maxCoin.value, Math.max(0, Math.trunc(Number(target.value) || 0)))
    mxActions.setOfItemCoin(code, coin)
    target.value = coin > 0 ? String(coin) : ''
  },
  /** 選號格：點號碼 */
  pick: (pos: number, num: number) => mxActions.toggleOfPick(pos, num),
  pickAll: (pos: number) => mxActions.toggleOfPickAll(pos),
  page: (page: number) => mxActions.setOfSinglePage(page)
}
</script>

<template>
  <div class="x5-board x5-of-board">
    <!-- 該分頁限額（伺端以同一份 settings.quota 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ money(minCoin) }} — {{ money(maxCoin) }}</span>
      <span v-if="ofQuota.issue.max > 0" class="quota-item">單期上限 {{ money(ofQuota.issue.max) }}</span>
      <span class="quota-note">
        <template v-if="layoutMode === 'list' || layoutMode === 'single'">※ 點注碼即選取並套用投注金額，也可逐項改金額</template>
        <template v-else-if="layoutMode === 'dantuo'">※ 膽碼每注必中，拖碼補足碼數；同一號碼不可同時選為膽與拖</template>
        <template v-else>※ 多選後會展開成多注，每注金額相同</template>
      </span>
    </div>

    <!-- 彩池分頁：沒有固定賠率，改列分層說明 -->
    <div v-if="ofIsPool" class="pool-bar">
      <span class="pool-title">本分頁吃共用彩池</span>
      <span v-for="tier in ofPrizeTiers" :key="tier.match" class="pool-tier">
        命中 {{ tier.match }} 位 · {{ tier.name }}
        <b v-if="tier.type === 'pool'">獎池 {{ (tier.ratio * 100).toFixed(0) }}%</b>
        <b v-else>固定 {{ tier.amount }} 倍</b>
      </span>
    </div>

    <!-- ── 1. 單選分頁（定位膽／不定位／趣味玩法）────────────────── -->
    <template v-if="layoutMode === 'list'">
      <div v-for="group in ofItemGroups" :key="`of-list-${group.groupName}`" class="play-group">
        <div class="group-title">{{ group.groupName }}</div>
        <div class="code-grid" :style="{ '--cols': group.columns }">
          <button v-for="item in group.items" :key="item.name" type="button" class="code-cell"
            :class="{ active: mxActions.isOfItemSelected(item.name) }" @click="click.code(item.name)">
            <span v-if="_handlers.isNumeric(_handlers.shortItemOf(item.name, group.groupName))" class="ball-set">
              <Ball :digit="_handlers.shortItemOf(item.name, group.groupName)" size="sm" />
            </span>
            <span v-else class="code-text">{{ _handlers.shortItemOf(item.name, group.groupName) }}</span>
            <em class="code-odds">{{ ofIsPool ? '彩池' : (mxActions.ofOddsOf(item.name) || '—') }}</em>
          </button>
        </div>
      </div>
    </template>

    <!-- ── 2. 單式分頁：conf 列出的全部注碼，分頁顯示 ───────────── -->
    <template v-else-if="layoutMode === 'single'">
      <div class="play-group">
        <div class="group-title">
          {{ mxOf.tabName }}
          <span class="group-odds">
            共 {{ money(ofSingleAllCodes.length) }} 注可選
            <template v-if="!ofIsPool">· 賠率 {{ mxActions.ofOddsOf(ofSingleAllCodes[0] ?? '') || '—' }}</template>
            <template v-else>· 彩池分層</template>
          </span>
        </div>
        <div class="code-grid is-single" :style="{ '--cols': 6 }">
          <button v-for="code in ofSingleCodes" :key="code" type="button" class="code-cell is-code"
            :class="{ active: mxActions.isOfItemSelected(code) }" @click="click.code(code)">
            <span class="code-text">{{ _handlers.shortOf(code) }}</span>
          </button>
        </div>
        <!-- 990 注一次畫出來會拖慢畫面，這裡分頁；翻頁不影響已選的注碼 -->
        <div v-if="ofSinglePageCount > 1" class="pager">
          <button type="button" class="pager-btn" :disabled="mxOf.singlePage <= 0"
            @click="click.page(mxOf.singlePage - 1)">← 上一頁</button>
          <span class="pager-info">{{ mxOf.singlePage + 1 }} / {{ ofSinglePageCount }}</span>
          <button type="button" class="pager-btn" :disabled="mxOf.singlePage >= ofSinglePageCount - 1"
            @click="click.page(mxOf.singlePage + 1)">下一頁 →</button>
        </div>
      </div>
    </template>

    <!-- ── 3 & 4. 展開型（選號格）與膽拖 ────────────────────────── -->
    <template v-else>
      <div v-for="group in ofComboGroups" :key="`of-pick-${group.pos}`" class="play-group">
        <div class="group-title">
          {{ group.label }}
          <span class="group-hint">
            <template v-if="layoutMode === 'dantuo' && group.pos === 0">
              膽碼（1 ~ {{ Number(ofCombo?.size ?? 0) - 1 }} 個，每注必中）
            </template>
            <template v-else-if="layoutMode === 'dantuo'">拖碼（補足 {{ ofCombo?.size }} 碼）</template>
            <template v-else-if="group.minPick > 1">至少選 {{ group.minPick }} 個</template>
            <template v-else>至少選 1 個</template>
          </span>
          <button type="button" class="all-btn" @click="click.pickAll(group.pos)">全選 / 清空</button>
        </div>
        <div class="pick-grid" :style="{ '--cols': group.columns }">
          <button v-for="num in group.digits" :key="`${group.pos}-${num}`" type="button" class="pick-cell"
            :class="{ active: mxActions.isOfPickSelected(group.pos, num) }" @click="click.pick(group.pos, num)">
            <Ball :digit="num" size="md" :muted="!mxActions.isOfPickSelected(group.pos, num)" />
          </button>
        </div>
      </div>

      <!-- 展開結果：注數與提示（沒選滿／超過上限的原因只有 composable 那一份文案） -->
      <div class="expand-bar" :class="{ 'is-warn': ofComboHint }">
        <span v-if="ofComboHint">{{ ofComboHint }}</span>
        <template v-else>
          <span>展開 <b>{{ money(ofExpandedCodes.length) }}</b> 注</span>
          <span class="expand-sample">例：{{ _handlers.shortOf(ofExpandedCodes[0] ?? '') }}</span>
          <span v-if="!ofIsPool" class="expand-odds">
            單注賠率 {{ mxActions.ofOddsOf(ofExpandedCodes[0] ?? '') || '—' }}
          </span>
          <span class="expand-total">共 {{ money(ofExpandedCodes.length * Number(mxState.amount || 0)) }} 元</span>
        </template>
      </div>
      <p v-if="ofRawComboCount > 0 && !ofComboHint" class="expand-note">
        ※ 展開後的每一注都用「投注金額」的值，單注上限 {{ money(maxCoin) }}
      </p>
    </template>

    <!-- 單選／單式：已選注碼的金額（逐項可改） -->
    <div v-if="(layoutMode === 'list' || layoutMode === 'single') && mxOf.items.length > 0" class="picked-warp">
      <div class="picked-head">已選 {{ ofSelectedCount }} 注</div>
      <div class="picked-list">
        <div v-for="item in mxOf.items" :key="item.code" class="picked-row">
          <span class="picked-code">{{ _handlers.shortOf(item.code) }}</span>
          <span class="picked-odds">{{ ofIsPool ? '彩池' : (item.odds || '—') }}</span>
          <input type="number" min="0" :max="maxCoin" :value="item.coin || ''" placeholder="0"
            @input="click.codeCoin(item.code, $event)" />
        </div>
      </div>
    </div>

    <div v-if="layoutMode === 'list' && ofItemGroups.length === 0" class="empty">此分頁尚無注項</div>
  </div>
</template>

<style scoped lang="scss">
/* 版面沿用信用盤看板（.x5-board）的色票與間距，只是選號介面換成官方盤的四種 */
.x5-of-board {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .quota-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border: 1px solid #fee2e2;
    border-radius: 0.25rem;
    background: #fff5f6;
    padding: 6px 10px;
    font-size: 12px;

    .quota-item {
      font-weight: 700;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;

      &+.quota-item::before {
        content: '·';
        margin-right: 8px;
        color: var(--color-red-desc);
      }
    }

    .quota-note {
      margin-left: auto;
      color: var(--color-red-desc);
    }
  }

  /* 彩池分頁的分層說明（與其他分頁的固定賠率明顯區隔：黃底） */
  .pool-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    border: 1px solid #fcd34d;
    border-radius: 0.25rem;
    background: #fffbeb;
    padding: 6px 10px;
    font-size: 12px;

    .pool-title {
      font-weight: 800;
      color: #b45309;
    }

    .pool-tier {
      color: #92400e;

      b {
        margin-left: 4px;
        font-variant-numeric: tabular-nums;
      }
    }
  }

  .empty {
    padding: 24px;
    text-align: center;
    font-weight: 700;
    color: var(--color-red-desc);
  }

  .play-group {
    display: flex;
    flex-direction: column;

    .group-title {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0.5rem 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-red-main);

      .group-odds,
      .group-hint {
        font-size: 11px;
        font-weight: 700;
        color: var(--color-red-desc);
        font-variant-numeric: tabular-nums;
      }

      /* 全選／清空：靠右，樣式與 6hc-of 的 .bar-tabs-btn 同一套 */
      .all-btn {
        margin-left: auto;
        border: 1px solid #f3b7bf;
        border-radius: 0.25rem;
        background: #fff5f6;
        padding: 2px 10px;
        font-size: 11px;
        font-weight: 700;
        color: var(--color-red-main);
        cursor: pointer;

        &:hover {
          border-color: var(--color-red-main);
          background: var(--color-red-main);
          color: #fff;
        }
      }
    }
  }

  /* 注碼格（單選／單式）：一格一注，號碼球或文字 + 賠率 */
  .code-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols, 6), minmax(0, 1fr));
    gap: 6px;

    &.is-single {
      /* 單式的注碼較長（01 02 03），格子要寬一點 */
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    }
  }

  .code-cell {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    border: 1px solid var(--color-red-content);
    border-radius: 6px;
    background: #fff;
    padding: 4px 6px;
    cursor: pointer;
    transition: all 0.15s ease;

    .code-text {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .code-odds {
      font-style: normal;
      font-size: 11px;
      font-weight: 700;
      color: #b45309;
      font-variant-numeric: tabular-nums;
    }

    .ball-set {
      display: inline-flex;
      pointer-events: none;
    }

    &:hover {
      border-color: var(--color-red-main);
      background: #fbe3e6;
    }

    &.active {
      border-color: var(--color-red-main);
      background: var(--color-yellow-text);
    }
  }

  /* 選號格（展開型／膽拖）：一排號碼球 */
  .pick-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols, 6), minmax(0, 1fr));
    gap: 6px;
  }

  .pick-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    border: 1px solid var(--color-red-content);
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    transition: all 0.15s ease;

    :deep(.x5-ball) {
      pointer-events: none;
    }

    &:hover {
      border-color: var(--color-red-main);
      background: #fbe3e6;
    }

    &.active {
      border-color: var(--color-red-main);
      background: var(--color-yellow-text);
    }
  }

  /* 展開結果列：注數／樣本注碼／單注賠率／總額 */
  .expand-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    border: 1px solid #fee2e2;
    border-radius: 0.25rem;
    background: #fff5f6;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-red-main);

    b {
      font-size: 14px;
      font-variant-numeric: tabular-nums;
    }

    .expand-sample,
    .expand-odds,
    .expand-total {
      font-weight: 600;
      color: var(--color-red-desc);
      font-variant-numeric: tabular-nums;
    }

    .expand-total {
      margin-left: auto;
    }

    /* 選號不完整／超過上限：整條改成警示色 */
    &.is-warn {
      border-color: #fcd34d;
      background: #fffbeb;
      color: #b45309;
    }
  }

  .expand-note {
    margin: 0;
    font-size: 11px;
    color: var(--color-red-desc);
  }

  /* 單式的分頁器 */
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding-top: 8px;

    .pager-btn {
      border: 1px solid #f3b7bf;
      border-radius: 0.25rem;
      background: #fff5f6;
      padding: 3px 12px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .pager-info {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-desc);
      font-variant-numeric: tabular-nums;
    }
  }

  /* 已選注碼（單選／單式）的金額列 */
  .picked-warp {
    border: 1px solid var(--color-red-content);
    border-radius: 6px;
    background: #fffafa;
    padding: 8px;

    .picked-head {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      padding-bottom: 6px;
    }

    .picked-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 6px;
      max-height: 180px;
      overflow-y: auto;
    }

    .picked-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;

      .picked-code {
        flex: 1 1 auto;
        font-weight: 700;
        color: var(--color-red-main);
        font-variant-numeric: tabular-nums;
      }

      .picked-odds {
        flex: 0 0 auto;
        font-weight: 700;
        color: #b45309;
        font-variant-numeric: tabular-nums;
      }

      input {
        flex: 0 0 72px;
        height: 26px;
        border: 1px solid #f3b7bf;
        border-radius: 4px;
        background: #fff;
        text-align: center;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-main);
        outline: none;

        &:focus {
          border-color: var(--color-red-main);
        }
      }
    }
  }
}
</style>
