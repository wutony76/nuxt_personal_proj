<template>
  <div class="duplex">
    <div class="block-selected shadow">
      <A6BetHead />
      <A6BetSelector />
    </div>
    <div class="block-bet shadow">
      <A6BetGroup />
    </div>
    <div class="block-fav shadow">
      <A6BetFav />
    </div>
  </div>
</template>

<style scoped lang="scss">
.duplex {
  display: grid;
  gap: 12px;
}
</style>
