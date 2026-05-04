<script setup>
import { computed } from 'vue'

const props = defineProps({
  options: {
    type: Array,
    default: () => []
  },
  selectedCodes: {
    type: Array,
    default: () => []
  },
  selectedType: {
    type: String,
    default: ''
  },
  playLabel: {
    type: String,
    default: ''
  },
  amount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['toggle'])

const columnCount = 4
const rowGroups = computed(() => {
  const list = Array.isArray(props.options) ? props.options : []
  if (list.length === 0) {
    return []
  }
  const rows = Math.ceil(list.length / columnCount)
  return Array.from({ length: rows }, (_, rowIndex) => {
    return Array.from({ length: columnCount }, (_, colIndex) => {
      return list[rowIndex + colIndex * rows] || null
    })
  })
})

const click = {
  toggle: (option) => {
    emit('toggle', option)
  }
}

const _handlers = {
  isSelected: (option) => props.selectedCodes.includes(option?.label),
  getOdds: (option) => {
    const label = String(option?.label || '')
    if (/^\d+$/.test(label)) {
      return '49.0'
    }
    return '2.0'
  }
}
</script>

<template>
  <section class="simple-panel layout-like-origin">
    <header class="panel-header">
      <strong>{{ props.playLabel || props.selectedType || '玩法' }}</strong>
      <span>單注金額：{{ Number(props.amount || 0).toLocaleString() }}</span>
    </header>

    <div class="summary-row">
      <span>單注註數：{{ props.selectedCodes.length }}</span>
      <span>單注總額：{{ (props.selectedCodes.length * Number(props.amount || 0)).toLocaleString() }}</span>
      <span>色波：0%</span>
      <span>兩面：0%</span>
    </div>

    <table class="simple-table">
      <thead>
        <tr>
          <template v-for="col in columnCount" :key="`head-${col}`">
            <th>號碼</th>
            <th>賠率</th>
            <th>金額</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rowGroups" :key="`row-${rowIndex}`">
          <template v-for="(option, colIndex) in row" :key="`cell-${rowIndex}-${colIndex}`">
            <td>
              <button
                v-if="option"
                type="button"
                class="cell-btn"
                :class="{ active: _handlers.isSelected(option) }"
                @click="click.toggle(option)">
                <span class="ball-like" :class="{ num: /^\\d+$/.test(String(option.label)) }">
                  {{ option.label }}
                </span>
              </button>
            </td>
            <td>
              <span v-if="option">{{ _handlers.getOdds(option) }}</span>
            </td>
            <td>
              <input
                v-if="option"
                type="number"
                min="0"
                :value="_handlers.isSelected(option) ? props.amount : 0"
                readonly />
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped lang="scss">
.simple-panel {
  border: 1px solid #dcebf6;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.panel-header {
  padding: 0.45rem 0.6rem;
  background: #f5f5f5;
  color: #4b4b4b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
  border-bottom: 1px solid #e7e7e7;
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.72rem;
  color: #557d97;
  background: #f3f9fd;
  border-bottom: 1px solid #d5e6f3;
}

.simple-table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border-top: 1px solid #ececec;
    padding: 0.25rem 0.35rem;
    font-size: 0.74rem;
    text-align: center;
  }

  th {
    color: #4e4e4e;
    background: #fafafa;
  }
}

.cell-btn {
  border: 1px solid transparent;
  background: transparent;
  padding: 0;
  cursor: pointer;

  &.active {
    .ball-like {
      border-color: #1f94d7;
      color: #1f94d7;
      background: #e8f6ff;
    }
  }
}

.ball-like {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 22px;
  border-radius: 999px;
  background: #f4f4f4;
  color: #4b4b4b;
  font-weight: 700;
  padding: 0 0.4rem;
}

.ball-like.num {
  border: 1px solid #d5d5d5;
  background: #fff;
}

input {
  width: 56px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  text-align: center;
  font-size: 0.72rem;
  color: #6f6f6f;
  padding: 0.12rem;
}
</style>
