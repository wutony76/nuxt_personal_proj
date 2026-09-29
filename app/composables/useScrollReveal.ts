import type { Directive } from 'vue'

type RevealVariant = 'up' | 'left' | 'right' | 'scale'

interface RevealBinding {
  delay?: number
  variant?: RevealVariant
}

const REVEAL_CLASS = 'pf-reveal'
const REVEAL_VISIBLE_CLASS = 'pf-reveal-visible'

function observe(el: HTMLElement) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.classList.add(REVEAL_VISIBLE_CLASS)
          observer.unobserve(el)
        }
      })
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
  )
  observer.observe(el)
}

/**
 * 進入視窗時觸發淡入位移動畫的自訂指令 `v-reveal`。
 * `v-reveal="{ delay: 80, variant: 'left' }"` 可設定進場延遲（毫秒）與進場方向，用於做 stagger 與分層效果。
 * variant 預設 `up`（由下往上淡入），另支援 `left` / `right`（左右滑入）、`scale`（縮放淡入）。
 */
export function useScrollReveal() {
  const vReveal: Directive<HTMLElement, RevealBinding | undefined> = {
    mounted(el, binding) {
      el.classList.add(REVEAL_CLASS)
      const variant = binding.value?.variant
      if (variant && variant !== 'up') {
        el.classList.add(`${REVEAL_CLASS}-${variant}`)
      }
      const delay = binding.value?.delay
      if (delay) {
        el.style.transitionDelay = `${delay}ms`
      }
      observe(el)
    }
  }

  return { vReveal }
}
