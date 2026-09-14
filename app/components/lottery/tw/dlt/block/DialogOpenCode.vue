<script setup lang="ts">
import DialogShell from '~/components/lottery/tw/dlt/block/DialogShell.vue'
import Ball from '~/components/lottery/tw/dlt/base/Ball.vue'
import { useDlt } from '~/composables/useDlt'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { openCodeHistory } = useDlt()
</script>

<template>
  <DialogShell :visible="props.visible" title="開獎歷史" @close="emit('close')">
    <p class="dlt-opencode-hint">
      開獎號碼為官方大樂透實際開出的號碼，逐期由本站累積紀錄；上線初期筆數較少屬正常現象。
    </p>
    <ul class="dlt-opencode-list">
      <li v-for="row in openCodeHistory.list" :key="row.issue" class="dlt-opencode-row">
        <span class="dlt-opencode-issue">第 {{ row.issue }} 期</span>
        <span class="dlt-opencode-balls">
          <Ball v-for="(n, idx) in row.openCode.slice(0, 6)" :key="idx" :num="n" size="sm" />
          <span>+</span>
          <Ball :num="row.openCode[6]" size="sm" special />
        </span>
      </li>
    </ul>
  </DialogShell>
</template>

<style scoped lang="scss">
.dlt-opencode-hint {
  font-size: 12px;
  color: var(--color-red-desc);
  margin: 0 0 0.75rem;
}

.dlt-opencode-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dlt-opencode-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 13px;
}

.dlt-opencode-issue {
  flex: 0 0 110px;
  color: var(--color-red-desc);
}

.dlt-opencode-balls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
