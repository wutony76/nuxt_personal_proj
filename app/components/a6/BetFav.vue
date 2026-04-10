<script setup lang="ts">
import { use6hcOfficial } from '~/composables/use6hcOfficial'

const a6 = use6hcOfficial()
</script>

<template>
  <div class="block-fav">
    <h3>我的心水注項</h3>
    <ul>
      <li v-for="item in a6.state.favRows" :key="`fav-${item.id}`">
        {{ item.mode }}｜{{ item.code }}
      </li>
      <li v-if="a6.state.favRows.length === 0" class="empty">尚無記錄</li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.block-fav {
  padding: 0;

  h3 {
    margin: 0;
    padding: 12px 20px;
    color: #333;
    font-size: 16px;
    border-bottom: 1px solid #e1e1e1;
  }

  ul {
    margin: 0;
    padding: 0 20px;
    list-style: none;
  }

  li {
    font-size: 12px;
    color: #334155;
    padding: 7px 0;
    border-bottom: 1px dashed #e2e8f0;
  }

  .empty {
    color: #94a3b8;
  }
}
</style>
