<script setup lang="ts">
const { state: mxState, groupList: mxGroupList } = use6hcCredit()

const _handle = {
  find: () => {
    const _find = mxGroupList.value.find((group) => group.tabId === mxState.selectTabId)
    if (_find) mxState.selectTabName = _find.tabName
  }
}

watch(() => mxState.selectTabId, () => {
  _handle.find(), { immediate: true }
})

// const init = {
//   base: () => {
//     _handle.find()
//   }
// }

// init.base()

</script>

<template>
  <section class="bar-tabs">
    <button v-for="group in mxGroupList" :key="group.tabId" type="button" class="bar-tabs-btn"
      :class="{ active: mxState.selectTabId === group.tabId }" @click="mxState.selectTabId = group.tabId">
      {{ group.tabName }}
    </button>
  </section>
</template>

<style scoped lang="scss">
.bar-tabs {
  margin-bottom: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  &-btn {
    border: 1px solid #f3b7bf;
    border-radius: 0.25rem;
    background: #fff5f6;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main);
    cursor: pointer;

    &.active {
      background: var(--color-red-main);
      color: #fff;
      border-color: var(--color-red-main);
    }
  }
}
</style>
