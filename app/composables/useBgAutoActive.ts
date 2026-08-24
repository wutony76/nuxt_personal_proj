import { ref, readonly } from 'vue'

type LotteryType = '6hc-of' | '6hc-cd' | 'k3-cd' | 'k3-of' | 'pk10-cd' | 'pk10-of' | 'ssc-cd' | 'ssc-of'
  | 'x5-cd' | 'x5-of' | 'eggs' | 'kl10' | 'kl8' | 'fc3d' | 'pl3'

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
