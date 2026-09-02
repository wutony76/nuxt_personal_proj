<script setup lang="ts">
/**
 * 聊天室排程面板：設定到點／間隔自動以「管理者: {建立者名稱}」發送到全站聊天室。
 * 時間用自訂 picker（選取色走 --ink），不依賴原生 time 彈層的系統藍。
 */
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { api, type ChatSchedule, type ChatScheduleRepeat } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const MIN_INTERVAL_SECONDS = 5
const MAX_INTERVAL_SECONDS = 86400

const state = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  schedules: [] as ChatSchedule[],
  draftText: '',
  draftHour: '07',
  draftMinute: '00',
  draftRepeat: 'daily' as ChatScheduleRepeat,
  draftIntervalSeconds: '30',
  submitStatus: 'idle' as AsyncStatus,
  submitError: '',
  timeOpen: false
})

const draftTime = computed(() => `${state.draftHour}:${state.draftMinute}`)
const isInterval = computed(() => state.draftRepeat === 'interval')
const rootRef = ref<HTMLElement | null>(null)
const hourListRef = ref<HTMLElement | null>(null)
const minuteListRef = ref<HTMLElement | null>(null)

const _handlers = {
  timeLabel: (hour: number, minute: number) =>
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  repeatLabel: (repeat: ChatScheduleRepeat) => {
    if (repeat === 'once') return '一次'
    if (repeat === 'interval') return '間隔'
    return '每天'
  },
  metaLabel: (row: ChatSchedule) => {
    if (row.repeat === 'interval') return `每 ${row.intervalSeconds ?? 0} 秒`
    return _handlers.timeLabel(row.hour, row.minute)
  },
  scrollSelectedIntoView: () => {
    nextTick(() => {
      hourListRef.value?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' })
      minuteListRef.value?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' })
    })
  }
}

const _actions = {
  fetch: async () => {
    if (state.status === 'loading') return
    state.status = 'loading'
    state.error = ''
    try {
      const res = await api.admin.chat.listSchedules()
      state.schedules = res.schedules
      state.status = 'success'
    } catch (e: unknown) {
      state.error = (e as { message?: string })?.message ?? '載入失敗'
      state.status = 'error'
    }
  },
  add: async () => {
    if (state.submitStatus === 'loading') return
    const text = state.draftText.trim()
    if (!text) {
      state.submitError = '請輸入訊息內容。'
      state.submitStatus = 'error'
      return
    }
    if (state.draftRepeat === 'interval') {
      const sec = Number(state.draftIntervalSeconds)
      if (!Number.isInteger(sec) || sec < MIN_INTERVAL_SECONDS || sec > MAX_INTERVAL_SECONDS) {
        state.submitError = `間隔秒數須為 ${MIN_INTERVAL_SECONDS}–${MAX_INTERVAL_SECONDS} 的整數。`
        state.submitStatus = 'error'
        return
      }
    }
    state.submitStatus = 'loading'
    state.submitError = ''
    state.timeOpen = false
    try {
      if (state.draftRepeat === 'interval') {
        await api.admin.chat.addSchedule({
          text,
          repeat: 'interval',
          intervalSeconds: Number(state.draftIntervalSeconds)
        })
      } else {
        await api.admin.chat.addSchedule({
          text,
          time: draftTime.value,
          repeat: state.draftRepeat
        })
      }
      state.draftText = ''
      state.submitStatus = 'success'
      await _actions.fetch()
    } catch (e: unknown) {
      state.submitError = (e as { message?: string })?.message ?? '新增失敗'
      state.submitStatus = 'error'
    }
  },
  remove: async (id: string) => {
    try {
      await api.admin.chat.removeSchedule(id)
      await _actions.fetch()
    } catch (e: unknown) {
      state.error = (e as { message?: string })?.message ?? '刪除失敗'
    }
  },
  toggleEnabled: async (row: ChatSchedule) => {
    const next = !row.enabled
    const prev = row.enabled
    row.enabled = next
    try {
      const res = await api.admin.chat.setScheduleEnabled(row.id, next)
      row.enabled = res.schedule.enabled
    } catch (e: unknown) {
      row.enabled = prev
      state.error = (e as { message?: string })?.message ?? '更新開關失敗'
    }
  }
}

const click = {
  add: () => _actions.add(),
  remove: (id: string) => _actions.remove(id),
  toggleEnabled: (row: ChatSchedule) => _actions.toggleEnabled(row),
  toggleTime: () => {
    state.timeOpen = !state.timeOpen
    if (state.timeOpen) _handlers.scrollSelectedIntoView()
  },
  pickHour: (h: string) => {
    state.draftHour = h
  },
  pickMinute: (m: string) => {
    state.draftMinute = m
    state.timeOpen = false
  },
  onDocPointer: (e: PointerEvent) => {
    if (!state.timeOpen || !rootRef.value) return
    if (!rootRef.value.contains(e.target as Node)) state.timeOpen = false
  }
}

watch(() => state.timeOpen, (open) => {
  if (open) _handlers.scrollSelectedIntoView()
})

watch(() => state.draftRepeat, (repeat) => {
  if (repeat === 'interval') state.timeOpen = false
})

onMounted(() => {
  _actions.fetch()
  document.addEventListener('pointerdown', click.onDocPointer)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', click.onDocPointer)
})
</script>

<template>
  <div class="acs">
    <div class="acs-head">
      <span class="acs-head-en admin-en">Schedule</span>
      <span class="acs-head-title">自動發言設定</span>
    </div>

    <div class="acs-form">
      <div class="admin-field">
        <label>訊息</label>
        <input v-model="state.draftText" type="text" class="admin-input" maxlength="200" placeholder="例如：大家早安"
          @keyup.enter="click.add">
      </div>
      <div class="acs-row">
        <div v-if="!isInterval" class="admin-field acs-field-time">
          <label>時間</label>
          <div ref="rootRef" class="acs-time">
            <button type="button" class="admin-input admin-num acs-time-trigger" :aria-expanded="state.timeOpen"
              @click="click.toggleTime">
              <span>{{ draftTime }}</span>
              <span class="acs-time-icon" aria-hidden="true">▾</span>
            </button>
            <div v-if="state.timeOpen" class="acs-time-panel" role="listbox" aria-label="選擇時間">
              <div ref="hourListRef" class="acs-time-col" role="group" aria-label="小時">
                <button v-for="h in HOUR_OPTIONS" :key="h" type="button" class="acs-time-opt admin-num"
                  :class="{ 'is-active': h === state.draftHour }" role="option" :aria-selected="h === state.draftHour"
                  @click="click.pickHour(h)">
                  {{ h }}
                </button>
              </div>
              <div ref="minuteListRef" class="acs-time-col" role="group" aria-label="分鐘">
                <button v-for="m in MINUTE_OPTIONS" :key="m" type="button" class="acs-time-opt admin-num"
                  :class="{ 'is-active': m === state.draftMinute }" role="option"
                  :aria-selected="m === state.draftMinute" @click="click.pickMinute(m)">
                  {{ m }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="admin-field acs-field-interval">
          <label>每 N 秒</label>
          <input v-model="state.draftIntervalSeconds" type="number" class="admin-input admin-num"
            :min="MIN_INTERVAL_SECONDS" :max="MAX_INTERVAL_SECONDS" step="1" placeholder="30" @keyup.enter="click.add">
        </div>
        <div class="admin-field acs-field-repeat">
          <label>重複</label>
          <select v-model="state.draftRepeat" class="admin-input">
            <option value="daily">每天</option>
            <option value="once">一次</option>
            <option value="interval">間隔</option>
          </select>
        </div>
      </div>
      <button type="button" class="admin-btn admin-btn-primary acs-add"
        :disabled="state.submitStatus === 'loading' || !state.draftText.trim()" @click="click.add">
        {{ state.submitStatus === 'loading' ? '新增中…' : '新增排程' }}
      </button>
      <p v-if="state.submitError" class="acs-error">{{ state.submitError }}</p>
    </div>

    <div v-if="state.status === 'loading'" class="admin-empty acs-empty">載入中…</div>
    <div v-else-if="state.status === 'error'" class="acs-error acs-pad">{{ state.error }}</div>
    <div v-else-if="state.schedules.length === 0" class="admin-empty acs-empty">
      尚無排程。例：大家早安 · 07:00 · 每天／每 30 秒 · 間隔
    </div>

    <ul v-else class="acs-list">
      <li v-for="row in state.schedules" :key="row.id" class="acs-item">
        <button
          type="button"
          class="acs-toggle"
          :class="row.enabled ? 'is-on' : 'is-off'"
          :aria-pressed="row.enabled"
          :title="row.enabled ? '點擊關閉' : '點擊開啟'"
          @click="click.toggleEnabled(row)"
        >
          {{ row.enabled ? '開啟' : '關閉' }}
        </button>
        <div class="acs-item-main">
          <div class="acs-item-text">{{ row.text }}</div>
          <div class="acs-item-meta admin-num">
            <span>{{ _handlers.metaLabel(row) }}</span>
            <span class="admin-tag">{{ _handlers.repeatLabel(row.repeat) }}</span>
          </div>
        </div>
        <button type="button" class="admin-btn admin-btn-ghost" @click="click.remove(row.id)">刪除</button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.acs {
  height: 420px;
  min-height: 0;
  max-height: 420px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 12px;
}

.acs-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
}

.acs-head-en {
  flex-shrink: 0;
}

.acs-head-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
}

.acs-form {
  flex-shrink: 0;
  padding: 10px;
  border-bottom: 1px solid var(--line);
  background: var(--wash);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.acs-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.acs-field-time,
.acs-field-interval,
.acs-field-repeat {
  flex: 1;
  min-width: 0;
}

.acs-time {
  position: relative;
}

.acs-time-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  text-align: left;
  cursor: pointer;
}

.acs-time-icon {
  color: var(--muted);
  font-size: 10px;
  line-height: 1;
}

.acs-time-panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--ink);
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 8px 24px color-mix(in srgb, #1c1c22 12%, transparent);
}

.acs-time-col {
  max-height: 180px;
  overflow-y: auto;
  background: var(--paper);
  display: flex;
  flex-direction: column;
}

.acs-time-opt {
  flex-shrink: 0;
  height: 30px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: center;

  &:hover {
    background: var(--wash);
  }

  &.is-active {
    background: var(--ink);
    color: var(--paper);
  }
}

.acs-add {
  width: 100%;
}

.acs-error {
  margin: 0;
  color: #b91c1c;
  font-size: 11px;
}

.acs-pad {
  padding: 10px;
}

.acs-empty {
  padding: 24px 10px;
}

.acs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.acs-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--line-soft);

  &:hover {
    background: var(--wash);
  }
}

.acs-toggle {
  flex-shrink: 0;
  min-width: 44px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 2px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;

  &.is-on {
    background: color-mix(in srgb, #16a34a 14%, var(--paper));
    border-color: #16a34a;
    color: #15803d;
  }

  &.is-off {
    background: color-mix(in srgb, #dc2626 12%, var(--paper));
    border-color: #dc2626;
    color: #b91c1c;
  }
}

.acs-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.acs-item-text {
  font-size: 13px;
  font-weight: 600;
  word-break: break-word;
}

.acs-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
}
</style>
