<script setup lang="ts">
</script>

<template>
  <AdminShell active="gamemgmt" kicker="Simulator" title="遊戲試算" desc="本次僅建立導覽入口。">
    <div class="ags-layout">
      <AdminGameNav active="simulator" />
      <div class="ags-content">
        <AdminComingSoon />
      </div>
    </div>
  </AdminShell>
</template>

<style scoped lang="scss">
.ags-layout {
  display: flex;
  gap: 44px;
  align-items: flex-start;
}

.ags-content {
  flex: 1;
  min-width: 0;
}
</style>
