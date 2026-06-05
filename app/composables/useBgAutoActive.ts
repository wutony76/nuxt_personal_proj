import { ref, readonly } from 'vue'

type LotteryType = '6hc-of' | '6hc-cd'

const _active = ref(false)
const _lotteryType = ref<LotteryType | null>(null)

export function useBgAutoActive() {
  return {
    active: readonly(_active),
    lotteryType: readonly(_lotteryType),
    activate: (type: LotteryType) => {
      _lotteryType.value = type
      _active.value = true
    },
    deactivate: () => {
      _active.value = false
      _lotteryType.value = null
    },
  }
}
