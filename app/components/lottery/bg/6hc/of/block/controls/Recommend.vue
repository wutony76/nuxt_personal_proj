<script setup lang="ts">
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'

const { state: mxState, road } = use6hcOfficial()

const recommendations = computed(() => {
  const plays = road.plays.filter(p => p.id !== 50 && p.num !== undefined)
  if (plays.length < 6) return []

  const byHot = [...plays].sort((a, b) => (b.countShow ?? 0) - (a.countShow ?? 0))
  const byCold = [...plays].sort((a, b) => (a.countShow ?? 0) - (b.countShow ?? 0))

  const hot6 = byHot.slice(0, 6).sort((a, b) => Number(a.num) - Number(b.num))
  const cold6 = byCold.slice(0, 6).sort((a, b) => Number(a.num) - Number(b.num))
  const balanced6 = [...byHot.slice(0, 3), ...byCold.slice(0, 3)].sort((a, b) => Number(a.num) - Number(b.num))

  return [
    { label: '熱號', tag: 'hot', nums: hot6 },
    { label: '冷號', tag: 'cold', nums: cold6 },
    { label: '均衡', tag: 'balanced', nums: balanced6 },
  ]
})

function apply(nums: (number | string | undefined)[]) {
  const targetSet = new Set(nums.map(n => Number(n)))
  mxState.playList = mxState.playList.map(item => ({
    ...item,
    selected: targetSet.has(Number(item.num)) && item.id !== 50,
  }))
}
</script>

<template>
  <div v-if="recommendations.length" class="recommend">
    <div class="recommend-title">號碼推薦</div>
    <div class="recommend-list">
      <div v-for="rec in recommendations" :key="rec.tag" class="recommend-row">
        <div class="rec-tag" :class="rec.tag">{{ rec.label }}</div>
        <div class="rec-balls">
          <Ball
            v-for="play in rec.nums"
            :key="play.id"
            :data="play"
            :is-click="false"
          />
        </div>
        <button type="button" class="rec-apply" @click="apply(rec.nums.map(p => p.num))">採用</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.recommend {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .recommend-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-red-main);
  }

  .recommend-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .recommend-row {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #fff;
    border: 1px solid #fee2e2;
    border-radius: 4px;
    padding: 4px 6px;
  }

  .rec-tag {
    flex: 0 0 28px;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    border-radius: 3px;
    padding: 2px 0;

    &.hot   { color: #e53e3e; background: #fff5f5; }
    &.cold  { color: #3182ce; background: #ebf8ff; }
    &.balanced { color: #38a169; background: #f0fff4; }
  }

  .rec-balls {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 2px;

    :deep(.ball-wrapper) .ball {
      width: 24px;
      height: 24px;
      font-size: 11px;
      border-width: 3px;
      cursor: default;
    }

    :deep(.count-wrap) {
      display: none;
    }
  }

  .rec-apply {
    flex: 0 0 auto;
    border: 1px solid var(--color-red-main);
    border-radius: 3px;
    background: #fff;
    color: var(--color-red-main);
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    cursor: pointer;

    &:hover {
      background: var(--color-red-main);
      color: #fff;
    }
  }
}
</style>
