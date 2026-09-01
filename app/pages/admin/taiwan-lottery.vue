<script setup lang="ts">
</script>

<template>
  <AdminShell active="gamemgmt" kicker="Taiwan Lottery" title="台彩甘仔店" desc="本次僅建立導覽入口。">
    <div class="atl-layout">
      <AdminGameNav active="taiwan" />
      <div class="atl-content">
        <AdminComingSoon />
      </div>
    </div>
  </AdminShell>
</template>

<style scoped lang="scss">
.atl-layout {
  display: flex;
  gap: 44px;
  align-items: flex-start;
}

.atl-content {
  flex: 1;
  min-width: 0;
}
</style>
