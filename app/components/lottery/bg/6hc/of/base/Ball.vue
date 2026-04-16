<template>
  <div class="ball-wrapper">
    <div class="ball flex-center"
      :class="[`ball-${color}`, { 'cursor-pointer': isClick }, { selected: selected }, { 'color-y': isColorY }]">
      <span>{{ displayNumber }}</span>
    </div>

    <div v-if="isShowIssue || isShowCount || isShowBetsCount" class="count-wrap">
      <div v-if="isShowIssue" class="count"> {{ props.data?.countIssue }} </div>
      <div v-if="isShowCount" class="count"> {{ props.data?.countShow }} </div>
      <div v-if="isShowBetsCount" class="count"> {{ props.data?.countBets }} </div>
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

const isShowIssue = computed(() => {
  return props.data?.countIssue >= 0 || false
})
const isShowCount = computed(() => {
  return props.data?.countShow >= 0 || false
})
const isShowBetsCount = computed(() => {
  return props.data?.countBets >= 0 || false
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
  flex-direction: column;
  align-items: center;
  justify-content: center;

  &.is-hide {
    display: none;
  }

  .ball {
    width: 3.2rem;
    height: 3.2rem;
    border: vw2rem(0.07) solid var(--6hcOf-ball-yellow);

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
      border-color: var(--6hcOf-ball-yellow);
    }

    &-blue {
      border-color: var(--6hcOf-ball-blue);
    }

    &-red {
      border-color: var(--6hcOf-ball-red);
    }

    &-green {
      border-color: var(--6hcOf-ball-green);
    }

    &.color-y {
      border-color: var(--6hcOf-ball-yellow) !important;
      border-width: vw2rem(0.35);
    }
  }

  .count-wrap {
    margin-top: 6px;

    .count {
      font-size: 12px;
      color: #6A5A3C;
    }

    .count+.count {
      margin-top: 4px;
    }
  }
}
</style>
