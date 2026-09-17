<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'

/**
 * MonthPicker：月份篩選器元件
 * emit: update:modelValue (YYYY-MM string)
 */
const props = defineProps({
  modelValue: {
    type: String,
    default: () => dayjs().format('YYYY-MM')
  }
})
const emit = defineEmits(['update:modelValue'])

const currentMonth = computed(() => props.modelValue || dayjs().format('YYYY-MM'))

/** 顯示用：YYYY / MM */
const displayMonth = computed(() => {
  const [y, m] = currentMonth.value.split('-')
  return `${y} / ${m}`
})

/** 是否為本月 */
const isCurrentMonth = computed(() => currentMonth.value === dayjs().format('YYYY-MM'))

const click = {
  prev: () => {
    const d = dayjs(`${currentMonth.value}-01`).subtract(1, 'month')
    emit('update:modelValue', d.format('YYYY-MM'))
  },
  next: () => {
    const d = dayjs(`${currentMonth.value}-01`).add(1, 'month')
    emit('update:modelValue', d.format('YYYY-MM'))
  },
  today: () => {
    emit('update:modelValue', dayjs().format('YYYY-MM'))
  }
}
</script>

<template>
  <div class="amp-wrap">
    <button type="button" class="admin-btn admin-btn-secondary amp-nav-btn" @click="click.prev">
      ‹ 上月
    </button>
    <div class="amp-month admin-num">{{ displayMonth }}</div>
    <button type="button" class="admin-btn admin-btn-secondary amp-nav-btn" @click="click.next">
      下月 ›
    </button>
    <button
      v-if="!isCurrentMonth"
      type="button"
      class="admin-btn admin-btn-ghost amp-today-btn"
      @click="click.today"
    >
      本月
    </button>
  </div>
</template>

<style scoped lang="scss">
.amp-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.amp-month {
  font-size: 18px;
  font-weight: 700;
  min-width: 110px;
  text-align: center;
  letter-spacing: 0.04em;
}

.amp-nav-btn {
  min-width: 72px;
}

.amp-today-btn {
  font-size: 12px;
  color: var(--muted);
  height: 28px;
  padding: 0 10px;
}
</style>
