<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useChat } from '~/composables/useChat'
import { useAuth } from '~/composables/useAuth'

const { messages, errorMessage, onlineCount, connected, actions } = useChat()
const { isLoggedIn } = useAuth()

const draft = ref('')
const listRef = ref<HTMLElement | null>(null)
/** 距底部小於這個距離視為「貼底」，新訊息才自動跟捲 */
const NEAR_BOTTOM_PX = 48
/** 是否貼底跟捲；由列表 scroll 事件更新 */
const stickToBottom = ref(true)

const _handlers = {
  isNearBottom: () => {
    const el = listRef.value
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
  },
  syncStickToBottom: () => {
    stickToBottom.value = _handlers.isNearBottom()
  },
  scrollToBottom: () => {
    nextTick(() => {
      const el = listRef.value
      if (!el) return
      el.scrollTop = el.scrollHeight
      stickToBottom.value = true
    })
  }
}

watch(messages, () => {
  if (stickToBottom.value) _handlers.scrollToBottom()
})

const formatTime = (ts: number) => {
  const date = new Date(ts)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const click = {
  send: () => {
    if (!draft.value.trim()) return
    actions.sendMessage(draft.value)
    draft.value = ''
    _handlers.scrollToBottom()
  },
  onListScroll: () => {
    _handlers.syncStickToBottom()
  }
}
</script>

<template>
  <div class="chat-panel">
    <div class="chat-head">
      <span class="online"><i class="dot" />{{ onlineCount }} 人在線</span>
      <span v-if="!connected" class="disconnected">連線中斷，重新連線中...</span>
    </div>

    <div ref="listRef" class="chat-list" @scroll="click.onListScroll">
      <p v-if="messages.length === 0" class="chat-empty">尚無訊息，開啟話題吧！</p>
      <div v-for="msg in messages" :key="msg.id" class="chat-row" :class="{ 'is-admin': msg.asAdmin }">
        <span class="user">{{ msg.userName }}</span>
        <span class="text">{{ msg.text }}</span>
        <span class="time">{{ formatTime(msg.ts) }}</span>
      </div>
    </div>

    <p v-if="errorMessage" class="chat-error">{{ errorMessage }}</p>

    <div class="chat-input">
      <input v-model="draft" type="text" maxlength="200" :disabled="!isLoggedIn"
        :placeholder="isLoggedIn ? '輸入訊息...' : '登入後才能發言'" @keyup.enter="click.send">
      <button type="button" :disabled="!isLoggedIn || !draft.trim()" @click="click.send">送出</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 沿用原本 11 份 Chat.vue placeholder 的配色 token（#efe6e6/#dcb4b4/var(--base-radius)），
   維持跟彩種頁面既有淺色系版面一致，不引入 game-hall 那套 Cyberpunk 深色配色 */
.chat-panel {
  flex: 0 0 auto;
  /* 外層 bg-auto-panel-warp 用 align-items:stretch，若只設 max-height 面板仍會隨左側自動下注
     面板／聊天內容跟著變高；固定死 267px，不論訊息多寡或左側面板高度都不再變動，改由
     chat-list 內部捲動 */
  height: 267px;
  background: #efe6e6;
  border: 1px solid #dcb4b4;
  border-radius: var(--base-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 12px;
  overflow-anchor: none;
  contain: layout;
}

.chat-panel * {
  overflow-anchor: none;
}

.chat-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid #dcb4b4;
  color: #7a5c5c;

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
    color: #c53b33;
  }
}

.chat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-empty {
  margin: auto;
  color: #a68a8a;
  text-align: center;
}

.chat-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  line-height: 1.5;

  &.is-admin .user {
    background: #c53b33;
    color: #fff;
    padding: 0 5px;
    border-radius: 2px;
  }

  .user {
    font-weight: 700;
    color: #c53b33;
    flex-shrink: 0;
  }

  .text {
    color: #3a2a2a;
    word-break: break-word;
  }

  .time {
    margin-left: auto;
    flex-shrink: 0;
    color: #a68a8a;
    font-size: 10px;
  }
}

.chat-error {
  flex-shrink: 0;
  margin: 0;
  padding: 4px 10px;
  color: #c53b33;
  font-size: 11px;
}

.chat-input {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  padding: 6px;
  border-top: 1px solid #dcb4b4;

  input {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    border: 1px solid #dcb4b4;
    border-radius: 4px;
    color: #3a2a2a;
    font-size: 12px;

    &:disabled {
      cursor: not-allowed;
    }
  }

  button {
    flex-shrink: 0;
    padding: 5px 12px;
    border: none;
    border-radius: 4px;
    background: #c53b33;
    color: #fff;
    font-size: 12px;
    cursor: pointer;

    &:disabled {
      background: #d9b5b5;
      cursor: not-allowed;
    }

    &:hover:not(:disabled) {
      background: #a83128;
    }
  }
}
</style>
