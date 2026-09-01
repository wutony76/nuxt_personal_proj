<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useChat } from '~/composables/useChat'
import { useAuth } from '~/composables/useAuth'

const props = withDefaults(defineProps<{ accentColor?: string }>(), { accentColor: '#ff8a2b' })

const { messages, errorMessage, onlineCount, connected, actions } = useChat()
const { isLoggedIn } = useAuth()

const panelStyle = computed(() => ({ '--accent': props.accentColor }))

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
    if (!isLoggedIn.value || !draft.value.trim()) return
    actions.sendMessage(draft.value)
    draft.value = ''
  }
}
</script>

<template>
  <div class="chp" :style="panelStyle">
    <div class="chp-head">
      <span class="online"><i class="dot" />{{ onlineCount }} 人在線</span>
      <span v-if="!connected" class="disconnected">連線中斷，重新連線中...</span>
    </div>

    <div ref="listRef" class="chp-list">
      <p v-if="messages.length === 0" class="chp-empty">// 尚無訊息，開啟話題吧</p>
      <div v-for="msg in messages" :key="msg.id" class="chp-row" :class="{ 'is-admin': msg.asAdmin }">
        <span class="user">{{ msg.userName }}</span>
        <span class="text">{{ msg.text }}</span>
        <span class="time">{{ formatTime(msg.ts) }}</span>
      </div>
    </div>

    <p v-if="errorMessage" class="chp-error">{{ errorMessage }}</p>

    <div v-if="!isLoggedIn" class="chp-guest">
      <span>登入後才能發言</span>
      <NuxtLink to="/login" class="chp-login-btn">前往登入</NuxtLink>
    </div>

    <div class="chp-input">
      <input v-model="draft" type="text" maxlength="200" :disabled="!isLoggedIn"
        :placeholder="isLoggedIn ? '輸入訊息...' : '登入後才能發言'" @keyup.enter="click.send">
      <button type="button" :disabled="!isLoggedIn || !draft.trim()" @click="click.send">送出</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/*
 * 不依賴外層頁面（game-hall.vue）的 CSS 變數，比照 GameRateDialog 的作法透過 --accent
 * 自行帶入主色，方便未來被其他 Cyberpunk 風頁面用不同顏色重用；中性色（背景／分隔線／文字）維持固定。
 */
.chp {
  /* 暖色調中性色（背景／分隔線／文字），跟隨 --accent 走同一色系，不用外層頁面的藍／青中性色 */
  --panel: #170f08;
  --line: #3a2412;
  --text: #ffe9d2;
  --text-dim: #c9a480;
  --text-mute: #8a6a4a;

  flex: 1;
  height: 100%;
  min-height: 220px;
  max-height: 320px;
  background: var(--panel);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: "Share Tech Mono", "JetBrains Mono", monospace;
  font-size: 12px;
}

.chp-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  color: var(--text-dim);
  letter-spacing: 0.08em;

  .online {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 6px var(--accent);
      animation: chp-pulse 1.6s infinite;
    }
  }

  .disconnected {
    color: #ff5e5e;
  }
}

.chp-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;

  scrollbar-width: thin;
  scrollbar-color: var(--accent) var(--panel);

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--panel);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--accent);
    border-radius: 999px;
  }
}

.chp-empty {
  margin: auto;
  color: var(--text-mute);
  text-align: center;
}

.chp-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  line-height: 1.5;

  &.is-admin .user {
    background: var(--accent);
    color: #1a0d02;
    padding: 0 5px;
  }

  .user {
    font-weight: 700;
    color: var(--accent);
    flex-shrink: 0;
  }

  .text {
    color: var(--text);
    word-break: break-word;
  }

  .time {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--text-mute);
    font-size: 10px;
  }
}

.chp-error {
  flex-shrink: 0;
  margin: 0;
  padding: 4px 12px;
  color: #ff5e5e;
  font-size: 11px;
}

.chp-guest {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 12px;
  border-top: 1px solid var(--line);
  background: rgba(255, 138, 43, 0.06);
  color: var(--text-dim);
  font-size: 11px;
  letter-spacing: 0.06em;

  .chp-login-btn {
    flex-shrink: 0;
    padding: 4px 10px;
    border: 1px solid var(--accent);
    color: var(--accent);
    text-decoration: none;
    letter-spacing: 0.1em;
    transition: background 0.15s, color 0.15s;

    &:hover {
      background: var(--accent);
      color: #1a0d02;
    }
  }
}

.chp-input {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid var(--line);

  input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    border: 1px solid var(--line);
    background: rgba(255, 138, 43, 0.04);
    color: var(--text);
    font-family: inherit;
    font-size: 12px;

    &::placeholder {
      color: var(--text-mute);
    }

    &:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 8px rgba(255, 138, 43, 0.35);
    }

    &:disabled {
      background: rgba(255, 138, 43, 0.015);
      cursor: not-allowed;
    }
  }

  button {
    flex-shrink: 0;
    padding: 6px 16px;
    border: none;
    background: var(--accent);
    color: #1a0d02;
    font-weight: 700;
    font-family: inherit;
    font-size: 12px;
    letter-spacing: 0.08em;
    cursor: pointer;
    clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);

    &:disabled {
      background: var(--line);
      color: var(--text-mute);
      cursor: not-allowed;
      clip-path: none;
    }

    &:hover:not(:disabled) {
      box-shadow: 0 0 12px rgba(255, 138, 43, 0.55);
    }
  }
}

@keyframes chp-pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.35;
  }
}
</style>
