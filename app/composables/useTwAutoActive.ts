import { ref, readonly } from 'vue'

/**
 * 複製自 useBgAutoActive.ts——bg／tw 兩個分類的自動下注面板刻意不共用同一份檔案
 * （見 openspec/changes/add-dlt/design.md Decision 0），改一邊不會牽動另一邊。
 * 未來若有更多 tw 系列玩法，直接在這個聯集型別加分支
 * （目前：大樂透 dlt、今彩539 d539、49樂合彩 m649、39樂合彩 m539）。
 */
type LotteryType = 'dlt' | 'd539' | 'm649' | 'm539'

const _active = ref(false)
const _lotteryType = ref<LotteryType | null>(null)

export function useTwAutoActive() {
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
