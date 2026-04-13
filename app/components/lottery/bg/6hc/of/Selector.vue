<script setup lang="ts">
import Ball from '~/components/lottery/bg/6hc/of/Ball.vue'

const { state: mxState, handle: mxHandle } = use6hcOfficial()

const selectedCount = computed(() => {
  return mxState.playList.filter(item => item.selected).length
})

const onPick = (num: number | string) => {
  mxHandle.toggleSelect(Number(num))
}
</script>

<template>
  <div class="selector">
    <div class="head">
      <span>請選擇號碼</span>
      <span class="picked">已選 {{ selectedCount }} 碼</span>
    </div>
    <div class="grid">
      <button v-for="item in mxState.playList" :key="item.id" type="button" class="ball-btn" @click="onPick(item.num)">
        <Ball :data="item" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.selector {
  width: 72%;
  background: #fff;
  border: 1px solid #fee2e2;
  border-radius: 6px;
  overflow: hidden;

  .head {
    height: 36px;
    background: var(--color-red-bets);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-red-bets);
    padding: 0 12px;
    font-size: 13px;
    font-weight: 600;

    .picked {
      color: var(--color-yellow-text);
      font-size: 12px;
    }
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.ball-btn {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
</style>