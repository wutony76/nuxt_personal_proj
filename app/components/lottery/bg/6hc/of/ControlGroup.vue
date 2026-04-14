<script setup lang="ts">
import { cloneDeep } from 'lodash'
import { use6hcOfficial } from '~/composables/use6hcOfficial'
import Ball from '~/components/lottery/bg/6hc/of/Ball.vue'
import IconSvg from '~/components/IconSvg.vue'
import { _uuid2 } from '~/utils/encrypt'

const { state: mxState, handle: mxHandle } = use6hcOfficial()
const click = {
  copy: (group: any) => {
    // console.log(group)
    const _bet = {
      hashKey: _uuid2(),
      playList: cloneDeep(group.playList),
    }
    mxState.groupList.push(_bet)
  },
  del: (group: any) => {
    const targetHashKey = group?.hashKey
    if (!targetHashKey) return
    mxState.groupList = mxState.groupList.filter((item: any) => item?.hashKey !== targetHashKey)
  },
}
</script>


<template>
  <div class="group">
    <div class="group-list">
      <div v-for="group in mxState.groupList.slice().reverse()" :key="group.id" class="group-bet">
        <div class="left">
          <Ball :data="play" v-for="play in group.playList" :key="play.id" />
        </div>
        <div class="right">
          <IconSvg icon-class="copy" class="icon" @click="click.copy(group)" />
          <IconSvg icon-class="del" class="icon" @click="click.del(group)" />
        </div>
      </div>
    </div>
    <div class="footer">
      <div> 當前注數：{{ mxState.groupList.length }} 注 </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.group {
  background: #fff;
  flex: 0 0 185px;
  border: 1px solid #fee2e2;
  border-radius: var(--base-radius);
  height: 185px;
  min-height: 120px;
  max-height: 185px;
  padding: 3px;

  display: flex;
  flex-direction: column;
  gap: 5px;

  .footer {
    height: 23px;
    display: flex;
    justify-content: flex-end;
    background: #fff;
    border-top: 1px solid #fee2e2;
    padding: 4px 7px 0 7px;
    text-align: right;
    font-size: 12px;
    color: var(--color-red-desc);
    z-index: 1;
  }

  .group-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: scroll;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

    display: flex;
    flex-direction: column;
    gap: 3px;

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #ffc6c6;
      border-radius: 999px;
    }

    &::-webkit-scrollbar-thumb {
      background: #f54c07;
      border-radius: 999px;
      border: 2px solid #ffc6c6;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #de4304;
    }
  }

  .group-bet {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-left: 7px;
    padding-right: -3px;

    .left {
      display: flex;
      align-items: center;
      justify-content: center;

      :deep(.ball-wrapper) {
        .ball {
          width: 30px;
          height: 30px;
          font-size: 13px;
          border-width: 4px;
          cursor: default;
        }
      }
    }

    .right {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;

      :deep(.icon) {
        cursor: pointer;
        flex: 0 0 auto;
        width: 23px;
        height: 23px;
        color: #f54c07;
        transition: color 0.2s ease;

        &:hover {
          color: var(--color-red-main);
        }

        svg {
          width: 100%;
          height: 100%;
        }
      }
    }

  }
}
</style>