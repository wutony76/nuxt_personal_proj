<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import type { Component } from 'vue'
import type { ToyCatalogItem } from '~/services/api'
import LuckyDraw from '~/pages/toys/lucky-draw.vue'
import Cards from '~/pages/toys/cards.vue'
import SodaWhistle from '~/pages/toys/soda-whistle.vue'
import BambooCopter from '~/pages/toys/bamboo-copter.vue'
import Gummy from '~/pages/toys/gummy.vue'
import BigPig from '~/pages/toys/big-pig.vue'
import WhistleCandy from '~/pages/toys/whistle-candy.vue'
import Pog from '~/pages/toys/pog.vue'

const panels: Record<string, Component> = {
  'lucky-draw': LuckyDraw,
  cards: Cards,
  'soda-whistle': SodaWhistle,
  'bamboo-copter': BambooCopter,
  gummy: Gummy,
  'big-pig': BigPig,
  'whistle-candy': WhistleCandy,
  pog: Pog
}

const props = defineProps<{
  item: ToyCatalogItem | null
}>()

const emit = defineEmits<{
  close: []
  switch: [item: ToyCatalogItem]
}>()

const panel = computed(() => (props.item ? panels[props.item.slug] ?? null : null))

/** 各玩具面板可用這個 inject 把自己的玩法提示塞進 dialog 標題列（例如抽抽樂的「連乘上限 ×N」） */
const subtitle = ref('')
provide('setToyDialogSubtitle', (text: string) => { subtitle.value = text })
provide('closeToyDialog', () => emit('close'))
/** 「其他玩具還有未領金額」擋住時，讓玩家直接切去那一款（BlockedModal.vue 用），
 *  不用先關閉這個彈窗再從櫥仔重新點一次 */
provide('switchToyDialog', (item: ToyCatalogItem) => emit('switch', item))

const close = () => emit('close')

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.item) close()
}

watch(() => props.item, (item) => {
  document.body.style.overflow = item ? 'hidden' : ''
  subtitle.value = ''
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="item && panel" class="toy-dialog-mask theme-taiwan-lottery" @click.self="close">
      <section class="toy-dialog" role="dialog" :aria-label="item.name">
        <header class="toy-dialog-head">
          <div class="toy-dialog-title">
            <h2>{{ item.name }}</h2>
            <span v-if="subtitle" class="toy-dialog-subtitle">{{ subtitle }}</span>
          </div>
          <button type="button" class="toy-dialog-close" aria-label="關閉" @click="close">×</button>
        </header>
        <div class="toy-dialog-body taiwan-lottery-scrollbar">
          <component :is="panel" />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.toy-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.toy-dialog {
  width: min(760px, 96vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 4px solid var(--color-accent-700, #8c491a);
  border-radius: 12px;
  background: var(--color-neutral-100, #f9f4ed);
}

.toy-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: #2e2b25;
  border-bottom: 2px solid var(--color-accent-2-400, #aebf92);

  .toy-dialog-title {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-family: var(--font-heading, serif);
    font-size: 20px;
    color: var(--color-bg, #f5ead8);
  }
}

.toy-dialog-subtitle {
  background: var(--color-accent-2-200, #e1eecc);
  color: var(--color-accent-2-800, #3d472b);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.toy-dialog-close {
  border: 0;
  background: transparent;
  color: var(--color-accent-300, #ffc6a5);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: var(--color-bg, #f5ead8);
  }
}

.toy-dialog-body {
  overflow: auto;

  /* 各玩具頁的 <main class="theme-taiwan-lottery"> 是給獨立整頁路由用的，min-height:100vh
     在這裡（嵌在彈窗裡）反而會把內容硬撐到跟視窗一樣高，明明內容裝得下卻還是跑出捲軸 */
  :deep(.theme-taiwan-lottery) {
    min-height: 0;
  }
}
</style>
