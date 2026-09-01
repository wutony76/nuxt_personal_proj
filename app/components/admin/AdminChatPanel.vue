<script setup lang="ts">
/**
 * 後台總覽用聊天室：版面結構比照 ChatPanel.vue，操作控件統一走 admin-input／admin-btn。
 * 送出帶 asAdmin，server 驗白名單後顯示「管理者: {name}」。
 */
import { nextTick, ref, watch } from 'vue'
import { useChat } from '~/composables/useChat'

const { messages, errorMessage, onlineCount, connected, actions } = useChat()

const draft = ref('')
const listRef = ref<HTMLElement | null>(null)

const scrollToBottom = () => {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  })
}
watch(messages, scrollToBottom, { deep: true })

const formatTime = (ts: number) => {
  const date = new Date(ts)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const click = {
  send: () => {
    if (!draft.value.trim()) return
    actions.sendMessage(draft.value, { asAdmin: true })
    draft.value = ''
  }
}
</script>

<template>
  <div class="chat-panel">
    <div class="chat-head">
      <span class="online"><i class="dot" />{{ onlineCount }} 人在線</span>
      <span v-if="!connected" class="disconnected">連線中斷，重新連線中...</span>
    </div>

    <div ref="listRef" class="chat-list">
      <p v-if="messages.length === 0" class="chat-empty">尚無訊息，開啟話題吧！</p>
      <div v-for="msg in messages" :key="msg.id" class="chat-row" :class="{ 'is-admin': msg.asAdmin }">
        <span class="user">{{ msg.userName }}</span>
        <span class="text">{{ msg.text }}</span>
        <span class="time">{{ formatTime(msg.ts) }}</span>
      </div>
    </div>

    <p v-if="errorMessage" class="chat-error">{{ errorMessage }}</p>

    <div class="chat-input">
      <input
        v-model="draft"
        type="text"
        class="admin-input"
        maxlength="200"
        placeholder="以管理者身分發言..."
        @keyup.enter="click.send"
      >
      <button
        type="button"
        class="admin-btn admin-btn-primary"
        :disabled="!draft.trim()"
        @click="click.send"
      >
        送出
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chat-panel {
  flex: 1;
  height: 100%;
  min-height: 280px;
  max-height: 420px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 12px;
}

.chat-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);

  .online {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #39c96a;
      box-shadow: 0 0 4px #39c96a;
    }
  }

  .disconnected {
    color: #b91c1c;
  }
}

.chat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-empty {
  margin: auto;
  color: var(--muted);
  text-align: center;
}

.chat-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  line-height: 1.5;

  &.is-admin .user {
    background: var(--ink);
    color: var(--paper);
    padding: 0 5px;
    border-radius: 2px;
  }

  .user {
    font-weight: 700;
    color: var(--ink);
    flex-shrink: 0;
  }

  .text {
    color: color-mix(in srgb, #1c1c22 82%, #ffffff);
    word-break: break-word;
  }

  .time {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--muted);
    font-size: 10px;
  }
}

.chat-error {
  flex-shrink: 0;
  margin: 0;
  padding: 4px 10px;
  color: #b91c1c;
  font-size: 11px;
}

.chat-input {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--line);
  background: var(--wash);

  .admin-input {
    flex: 1;
    min-width: 0;
    width: auto;
  }

  .admin-btn {
    flex-shrink: 0;
  }
}
</style>
