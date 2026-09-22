<script setup lang="ts"></script>

<template>
  <AdminShell active="npc" kicker="NPC" title="NPC" desc="NPC總設定，可以設定NPC的行為模式">
    <template #page-aside>
      <AdminNpcPageNav />
    </template>
    <AdminNpcPanel />
  </AdminShell>
</template>
