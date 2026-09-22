<script setup lang="ts"></script>

<template>
  <AdminShell active="npc" kicker="NPC" title="NPC 自動遊玩"
    desc="總開關、排程參數、NPC 會員的每日花費上限／自動儲值設定，以及可勾選讓 NPC 自動遊玩的遊戲清單。">
    <template #page-aside>
      <AdminNpcPageNav />
    </template>
    <AdminNpcPanel />
  </AdminShell>
</template>
