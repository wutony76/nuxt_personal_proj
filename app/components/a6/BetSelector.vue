<script setup lang="ts">
import { use6hcOfficial } from '~/composables/use6hcOfficial'

const a6 = use6hcOfficial()
</script>

<template>
  <div class="block-selector">
    <div v-if="a6.state.mode === 'dantuo'" class="dantuo-panel">
      <div class="group">
        <p>膽碼（最多 5）</p>
        <div class="balls">
          <button
            v-for="num in a6.numberPool"
            :key="`dan-${num}`"
            type="button"
            class="ball"
            :class="{ dan: a6.state.danPicks.includes(num) }"
            @click="a6.toggleDanTuo(num, 'dan')"
          >
            {{ String(num).padStart(2, '0') }}
          </button>
        </div>
      </div>
      <div class="group">
        <p>拖碼</p>
        <div class="balls">
          <button
            v-for="num in a6.numberPool"
            :key="`tuo-${num}`"
            type="button"
            class="ball"
            :class="{ tuo: a6.state.tuoPicks.includes(num) }"
            @click="a6.toggleDanTuo(num, 'tuo')"
          >
            {{ String(num).padStart(2, '0') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="balls">
      <button
        v-for="num in a6.numberPool"
        :key="num"
        type="button"
        class="ball"
        :class="a6.getBallClass(num)"
        @click="a6.togglePick(num)"
      >
        {{ String(num).padStart(2, '0') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.block-selector {
  padding-bottom: 16px;
}

.balls {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 1.3rem;
  padding: 1.4rem 20px 1.8rem;
}

.ball {
  border: 1px solid #dfe6ec;
  border-radius: 999px;
  height: 36px;
  font-size: 12px;
  font-weight: 700;
  background: #fff;
  color: #334155;
  cursor: pointer;

  &.red {
    background: #fee2e2;
    color: #b91c1c;
    border-color: #fecaca;
  }
  &.blue {
    background: #dbeafe;
    color: #1d4ed8;
    border-color: #bfdbfe;
  }
  &.green {
    background: #dcfce7;
    color: #15803d;
    border-color: #bbf7d0;
  }
  &.dan {
    background: #ffedd5;
    border-color: #fdba74;
    color: #9a3412;
  }
  &.tuo {
    background: #e0e7ff;
    border-color: #a5b4fc;
    color: #4338ca;
  }
}

.dantuo-panel {
  display: grid;
  gap: 12px;
  padding-top: 10px;

  .group {
    p {
      margin: 0;
      padding: 0 20px;
      font-size: 12px;
      color: #777;
      font-weight: 700;
    }
  }
}

@media (max-width: 960px) {
  .balls {
    grid-template-columns: repeat(7, 1fr);
  }
}
</style>
