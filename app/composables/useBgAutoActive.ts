import { ref, readonly } from 'vue'

const _active = ref(false)

export function useBgAutoActive() {
  return {
    active: readonly(_active),
    activate: () => { _active.value = true },
    deactivate: () => { _active.value = false },
  }
}
