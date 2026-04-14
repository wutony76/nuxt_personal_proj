<template>
  <div class="block-main record-issue">
    <div class="header">RecordIssue</div>
    <div class="main">
      MAIN
    </div>
  </div>
</template>

<script>
export default {

}
</script>

<style scoped lang="scss">
.record-issue {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fff;

  .header,
  .main {
    width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .header {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--color-red-700);
    font-weight: 700;
    color: var(--color-red-main);
  }

  .main {
    min-height: 32px;
  }

}
</style>