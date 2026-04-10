<template>
  <div class="ball-wrapper">
    <div class="ball flex-center"
      :class="[`ball-${color}`, { 'cursor-pointer': isClick }, { selected: selected }, { 'color-y': isColorY }]">
      <span>{{ displayNumber }}</span>
    </div>
  </div>
</template>

<script setup>
import { LHC_COLORS } from '~/config/bg/6hc-of'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  isClick: {
    type: Boolean,
    default: true,
  },
})

const color = computed(() => {
  return ui.getClassColor(props.data.label)
})
const selected = computed(() => {
  return props.data.selected || false
})
const displayNumber = computed(() => {
  const number = props.data.num
  return +number === 50 ? '全' : isNaN(+number) ? number : +number
})
const isColorY = computed(() => {
  return props.data.colorY || false
})

const ui = {
  // BALL COLOR
  getClassColor: (num) => {
    if (LHC_COLORS.red.includes(num)) return 'red'
    if (LHC_COLORS.blue.includes(num)) return 'blue'
    if (LHC_COLORS.green.includes(num)) return 'green'
    return 'yellow' // 預設顏色
  },
}
</script>

<style lang="scss" scoped>
@function vw2rem($value) {
  @return #{$value}rem;
}

.cursor-pointer {
  cursor: pointer;
}

.ball-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-hide {
    display: none;
  }

  .ball {
    width: 3.8rem;
    height: 3.8rem;
    border: vw2rem(0.07) solid var(--cdt-ball-yellow);

    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;

    color: #000;
    font-size: 1.825rem;
    font-weight: 600;

    &.selected {
      border-width: vw2rem(0.35);
    }

    &-yellow {
      border-color: var(--cdt-ball-yellow);
    }

    &-blue {
      border-color: var(--cdt-ball-blue);
    }

    &-red {
      border-color: var(--cdt-ball-red);
    }

    &-green {
      border-color: var(--cdt-ball-green);
    }

    &.color-y {
      border-color: var(--cdt-ball-yellow) !important;
      border-width: vw2rem(0.35);
    }
  }
}
</style>
