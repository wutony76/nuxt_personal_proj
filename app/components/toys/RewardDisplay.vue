<script setup lang="ts">
defineProps<{
  pot: number
  reward: number
}>()

const formatted = (value: number) => Number(value).toLocaleString('zh-TW')
</script>

<template>
  <section class="reward">
    <p>未領金額</p>
    <strong>F 幣 {{ formatted(pot) }}</strong>
    <p v-if="reward > 0" class="credited">已入帳 {{ formatted(reward) }}</p>
  </section>
</template>

<style scoped lang="scss">
.reward {
  background: var(--color-accent-2-200, #e1eecc);
  border: 2px solid var(--color-accent-2-400, #aebf92);
  border-radius: var(--radius-md, 16px);
  padding: 14px 16px;

  p {
    margin: 0;
    font-size: 13px;
  }

  strong {
    display: block;
    margin-top: 4px;
    font-family: var(--font-heading, serif);
    font-size: 28px;
  }
}

.credited {
  margin-top: 8px;
  color: var(--color-accent-800, #643312);
}
</style>
