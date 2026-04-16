<template>
  <div class="pagination-wrap">
    <div class="total">共 <strong>{{ total }}</strong> 筆</div>
    <div class="controls">
      <div v-if="showSizeChanger" class="size">
        <select v-model.number="pageSize" @change="throttleChange">
          <option v-for="s in sizes" :key="s" :value="s">{{ s }} 筆／頁</option>
        </select>
      </div>

      <button class="btn" :disabled="isFirst" @click="goPrev">‹</button>
      <button v-for="item in pageItems" :key="item.key" class="btn"
        :class="{ active: item.type === 'page' && item.page === currentPage, ellipsis: item.type !== 'page' }"
        :disabled="item.type !== 'page'" @click="item.type === 'page' && goTo(item.page)">
        {{ item.label }}
      </button>
      <button class="btn" :disabled="isLast" @click="goNext">›</button>

      <div v-if="showQuickJumper" class="jumper">
        前往第
        <input v-model.number="inputPage" class="page-input" :min="1" :max="totalPages" @keyup.enter="jump"
          @blur="onInputBlur" />
        頁
        <!-- <button class="btn go" @click="jump">Go</button> -->
      </div>
    </div>
  </div>
  <!-- totalPages: {{ totalPages }} curr: {{ currentPage }} size: {{ pageSize }} -->
</template>

<script setup lang="ts">
import { throttle } from 'lodash-es'

defineOptions({ name: 'AppPagination' })
type PageItem =
  | { key: string; type: 'page'; page: number; label: number }
  | { key: string; type: 'ellipsis'; label: '…' }

const props = defineProps({
  total: { type: Number, default: 0 },
  buffer: { type: Number, default: 2 }, // how many pages to show around current
  sizes: {
    type: Array as () => number[],
    default: () => [10, 20, 50, 100, 200, 500],
  },
  showSizeChanger: { type: Boolean, default: true },
  showQuickJumper: { type: Boolean, default: true },
})

const emit = defineEmits<{
  (e: 'change', payload: { pageNo: number; pageSize: number }): void
}>()

// v-models
const model = defineModel<number>({ default: 1 })
const modelSize = defineModel<number>('size', { default: 10 })

const inputPage = ref<number>(model.value)

const total = computed(() => Math.max(0, props.total))
const pageSize = computed({
  get: () => Math.max(1, modelSize.value || 1),
  set: (v: number) => {
    modelSize.value = v
  },
})
const totalPages = computed(() => {
  const pages = Math.ceil(total.value / pageSize.value)
  return Math.max(1, pages || 1)
})

const currentPage = computed({
  get: () => {
    const p = Number(model.value || 1)
    if (p < 1) return 1
    if (p > totalPages.value) return totalPages.value
    return p
  },
  set: (v: number) => {
    model.value = v
  },
})

const isFirst = computed(() => currentPage.value <= 1)
const isLast = computed(() => currentPage.value >= totalPages.value)

const pageItems = computed<PageItem[]>(() => {
  const items: PageItem[] = []
  const t = totalPages.value
  const curr = currentPage.value
  const buf = Math.max(0, props.buffer)

  const addPage = (p: number) => items.push({ key: `p-${p}`, type: 'page', page: p, label: p })
  const addEllipsis = (key: string) => items.push({ key, type: 'ellipsis', label: '…' })

  if (t <= 1) {
    addPage(1)
    return items
  }

  addPage(1)

  const start = Math.max(2, curr - buf)
  const end = Math.min(t - 1, curr + buf)

  if (start > 2) addEllipsis('el-l')

  for (let p = start; p <= end; p++) addPage(p)

  if (end < t - 1) addEllipsis('el-r')

  if (t > 1) addPage(t)
  return items
})

function goTo(page: number) {
  const p = Math.min(Math.max(1, page), totalPages.value)
  if (p === currentPage.value) return
  currentPage.value = p
  inputPage.value = p

  setTimeout(() => {
    // console.log('goTo', p, currentPage.value, pageSize.value)
    throttleChange()
  })
}
function goPrev() {
  if (isFirst.value) return
  goTo(currentPage.value - 1)
}
function goNext() {
  if (isLast.value) return
  goTo(currentPage.value + 1)
}
function jump() {
  goTo(Number(inputPage.value || 1))
}

function onInputBlur() {
  const val = Number(inputPage.value)
  if (Number.isFinite(val)) {
    goTo(val)
  } else {
    // reset invalid input to current page without emitting change
    inputPage.value = currentPage.value
  }
}

function handleChange() {
  // console.log('handleChange', currentPage.value, pageSize.value)
  model.value = currentPage.value
  modelSize.value = pageSize.value
  emit('change', { pageNo: currentPage.value, pageSize: pageSize.value })
}
const throttleChange = throttle(handleChange, 300)

watch([() => props.total, pageSize], () => {
  // reset current page if out of range when data/size changes
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
  if (currentPage.value < 1) currentPage.value = 1
  inputPage.value = currentPage.value
})

// watch(pageSize, (n, o) => {
//   if (n !== o) {
//     currentPage.value = 1
//     inputPage.value = 1
//     throttleChange()
//   }
// })

watch(currentPage, (n, o) => {
  if (n !== o) throttleChange()
})
</script>

<style scoped lang="scss">
.pagination-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-red-desc, #6e6e6e);

  .total {
    font-weight: 500;

    strong {
      font-weight: 700;
      color: var(--color-red-main, #d53f53);
    }
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn {
    width: auto;
    min-width: 30px;
    height: 28px;
    padding: 2px 10px;
    border: 1px solid var(--color-red-content, #d9d9d9);
    border-radius: 6px;
    background: #fff;
    color: var(--color-red-desc, #333);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease,
      box-shadow 0.15s ease;

    &:not([disabled]):not(.ellipsis):hover {
      border-color: color-mix(in srgb, var(--color-red-main, #d53f53) 45%, var(--color-red-content, #d9d9d9));
      box-shadow: 0 1px 2px color-mix(in srgb, var(--color-red-main, #d53f53) 12%, transparent);
    }
  }

  .btn[disabled] {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn.active {
    background: var(--color-red-main, #d53f53);
    color: #fff;
    border-color: var(--color-red-main, #d53f53);
    font-weight: 600;
  }

  .btn.ellipsis {
    cursor: default;
    background: transparent;
    border: none;
    padding: 0 6px;
    color: var(--color-red-desc, #6e6e6e);
    min-width: auto;
  }

  .size select {
    margin-right: 10px;
    padding: 4px 8px;
    border: 1px solid var(--color-red-content, #d9d9d9);
    border-radius: 6px;
    background: #fff;
    color: var(--color-red-desc, #333);
    cursor: pointer;
  }

  .jumper {
    margin-left: 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;

    .page-input {
      width: 44px;
      height: 28px;
      padding: 3px 6px;
      border: 1px solid var(--color-red-content, #d9d9d9);
      border-radius: 6px;
      text-align: center;
      color: var(--color-red-desc, #333);

      &:focus {
        outline: none;
        border-color: color-mix(in srgb, var(--color-red-main, #d53f53) 55%, var(--color-red-content, #d9d9d9));
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-red-main, #d53f53) 18%, transparent);
      }
    }
  }
}
</style>
