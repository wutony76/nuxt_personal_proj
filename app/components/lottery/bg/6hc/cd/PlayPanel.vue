<script setup>
import { computed } from 'vue'
import GenericOptions from './play-panels/GenericOptions.vue'
import BanboOptions from './play-panels/BanboOptions.vue'
import DuoxuanzhongyiOptions from './play-panels/DuoxuanzhongyiOptions.vue'
import IxiaolianOptions from './play-panels/IxiaolianOptions.vue'
import LianmaOptions from './play-panels/LianmaOptions.vue'
import QimaOptions from './play-panels/QimaOptions.vue'
import ShengxiaoOptions from './play-panels/ShengxiaoOptions.vue'
import TemaOptions from './play-panels/TemaOptions.vue'
import TouweishuOptions from './play-panels/TouweishuOptions.vue'
import WeishulianOptions from './play-panels/WeishulianOptions.vue'
import WuxingOptions from './play-panels/WuxingOptions.vue'
import ZhengmaOptions from './play-panels/ZhengmaOptions.vue'
import ZhengmateOptions from './play-panels/ZhengmateOptions.vue'
import ZhengterenzhongOptions from './play-panels/ZhengterenzhongOptions.vue'
import ZixuanbuzhongOptions from './play-panels/ZixuanbuzhongOptions.vue'

/**
 * @typedef {import('~/config/bg/6hc-cd').CreditPlayDefinition} CreditPlayDefinition
 */

const props = defineProps({
  /** @type {CreditPlayDefinition|null} */
  play: {
    type: Object,
    default: null
  },
  selectedType: {
    type: String,
    default: ''
  },
  availableCodes: {
    type: Array,
    default: () => []
  },
  selectedCodes: {
    type: Array,
    default: () => []
  },
  amount: {
    type: Number,
    default: 10
  },
  customCodeInput: {
    type: String,
    default: ''
  },
  canSubmit: {
    type: Boolean,
    default: false
  },
  submitStatus: {
    type: String,
    default: 'idle'
  },
  message: {
    type: String,
    default: ''
  },
  errorMessage: {
    type: String,
    default: ''
  },
  lastOrderId: {
    type: String,
    default: ''
  },
  lastOrders: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'select-type',
  'toggle-code',
  'quick-amount',
  'submit-bet',
  'append-custom-code',
  'reset-selection',
  'update:amount',
  'update:custom-code-input'
])

const showTypeTabs = computed(() => (props.play?.playTypeNames || []).length > 1)
const optionBoard = computed(() => {
  const playKey = props.play?.key || ''
  if (playKey === 'banbo') return BanboOptions
  if (playKey === 'duoxuanzhongyi') return DuoxuanzhongyiOptions
  if (playKey === 'ixiaolian') return IxiaolianOptions
  if (playKey === 'tema') return TemaOptions
  if (playKey === 'lianma') return LianmaOptions
  if (playKey === 'qima') return QimaOptions
  if (playKey === 'shengxiao') return ShengxiaoOptions
  if (playKey === 'touweishu') return TouweishuOptions
  if (playKey === 'weishulian') return WeishulianOptions
  if (playKey === 'wuxing') return WuxingOptions
  if (playKey === 'zhengma') return ZhengmaOptions
  if (playKey === 'zhengmate') return ZhengmateOptions
  if (playKey === 'zhengterenzhong') return ZhengterenzhongOptions
  if (playKey === 'zixuanbuzhong') return ZixuanbuzhongOptions
  return GenericOptions
})

const click = {
  handleSelectType: (typeName) => {
    emit('select-type', typeName)
  },
  handleToggleCode: (option) => {
    emit('toggle-code', option)
  },
  handleQuickAmount: (amount) => {
    emit('quick-amount', amount)
  },
  handleSubmitBet: () => {
    emit('submit-bet')
  },
  handleResetSelection: () => {
    emit('reset-selection')
  },
  handleAppendCustomCode: () => {
    emit('append-custom-code')
  },
  handleAmountInput: (event) => {
    emit('update:amount', Number(event.target.value || 0))
  },
  handleCustomCodeInput: (event) => {
    emit('update:custom-code-input', String(event.target.value || ''))
  }
}
</script>

<template>
  <section class="play-content">
    <article v-if="props.play" class="play-card">
      <div class="panel-top">
        <h2>{{ props.play.name }}</h2>
        <p>{{ props.play.description }}</p>
      </div>

      <div class="bet-limit-row">
        <span>單注最低: 5</span>
        <span>單注最高: 50,000,000</span>
        <span>單期最高: 400,000,000</span>
        <span>特碼A: 5%</span>
        <span>色波: 0%</span>
        <span>兩面: 0%</span>
      </div>

      <div v-if="showTypeTabs" class="type-tabs">
        <button
          v-for="typeName in props.play.playTypeNames"
          :key="typeName"
          type="button"
          class="type-btn"
          :class="{ active: typeName === props.selectedType }"
          @click="click.handleSelectType(typeName)">
          {{ typeName }}
        </button>
      </div>

      <section class="bet-controls">
        <h3 class="play-name">{{ props.selectedType || props.play.playTypeNames[0] || props.play.name }}</h3>

        <div class="bet-row custom-row">
          <label>快速追加（逗號分隔）</label>
          <div class="custom-input">
            <input
              :value="props.customCodeInput"
              type="text"
              placeholder="例如：01,08,紅波"
              @input="click.handleCustomCodeInput" />
            <button type="button" @click="click.handleAppendCustomCode">加入</button>
          </div>
        </div>

        <div class="bet-row">
          <label>下注選項</label>
          <component
            :is="optionBoard"
            :options="props.availableCodes"
            :selected-codes="props.selectedCodes"
            :selected-type="props.selectedType"
            :amount="props.amount"
            @toggle="click.handleToggleCode" />
        </div>
      </section>

      <dl class="meta-list">
        <div class="meta-row">
          <dt>來源模組</dt>
          <dd>{{ props.play.source }}</dd>
        </div>
        <div class="meta-row">
          <dt>子玩法數量</dt>
          <dd>{{ props.play.playTypeNames.length }}</dd>
        </div>
        <div class="meta-row">
          <dt>目前子玩法</dt>
          <dd>{{ props.selectedType || props.play.playTypeNames[0] }}</dd>
        </div>
      </dl>

      <div v-if="props.play.groupNames.length" class="group-list">
        <h3>玩法分組</h3>
        <ul>
          <li v-for="groupName in props.play.groupNames" :key="groupName">{{ groupName }}</li>
        </ul>
      </div>

      <section class="submit-block">
        <div class="summary">
          <span>已選 {{ props.selectedCodes.length }} 項</span>
          <span>單注 {{ Number(props.amount || 0).toLocaleString() }}</span>
          <span>總額 {{ (props.selectedCodes.length * Number(props.amount || 0)).toLocaleString() }}</span>
        </div>

        <div class="bottom-actions">
          <label class="amount-label">
            <span>金額</span>
            <input :value="props.amount" type="number" min="1" @input="click.handleAmountInput" />
          </label>
          <div class="quick-amount">
            <button v-for="quick in [5, 10, 20, 50, 100, 500]" :key="quick" type="button" @click="click.handleQuickAmount(quick)">
              {{ quick }}
            </button>
          </div>
          <button type="button" class="reset-btn" @click="click.handleResetSelection">重置</button>
          <button type="button" class="submit-btn" :disabled="!props.canSubmit" @click="click.handleSubmitBet">
            {{ props.submitStatus === 'loading' ? '下注中...' : '確定' }}
          </button>
        </div>

        <p v-if="props.message" class="message">{{ props.message }}</p>
        <p v-if="props.errorMessage" class="error">{{ props.errorMessage }}</p>
        <p v-if="props.lastOrderId" class="order-id">最新單號：{{ props.lastOrderId }}</p>
        <p v-if="props.lastOrders.length" class="order-count">拆單筆數：{{ props.lastOrders.length }}</p>
      </section>
    </article>
  </section>
</template>

<style scoped lang="scss">
.play-content {
  border: 1px solid #c7deef;
  border-radius: 8px;
  background: #fff;
  min-height: 180px;
  padding: 1rem;
}

.play-card {
  h2 {
    margin: 0;
    color: #2d9fe2;
    font-size: 1rem;
  }

  p {
    margin: 0.55rem 0 0.85rem;
    color: #6d8598;
    line-height: 1.6;
  }
}

.panel-top {
  margin-bottom: 0.4rem;
}

.bet-limit-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  padding: 0.28rem 0.55rem;
  border: 1px solid #d5e6f3;
  background: #f3f9fd;
  color: #507790;
  border-radius: 6px;
  font-size: 0.74rem;
  margin-bottom: 0.7rem;
}

.type-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.9rem;
}

.type-btn {
  border: 1px solid #b9d7ec;
  background: #fff;
  border-radius: 999px;
  color: #5f7f95;
  font-size: 0.75rem;
  padding: 0.22rem 0.62rem;
  cursor: pointer;

  &.active {
    color: #fff;
    border-color: #2d9fe2;
    background: #2d9fe2;
  }
}

.meta-list {
  margin: 0;
}

.meta-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 0.5rem;
  margin-bottom: 0.35rem;

  dt {
    color: #4a7088;
    font-weight: 700;
  }

  dd {
    margin: 0;
    color: #5d7486;
  }
}

.group-list {
  margin-top: 0.9rem;
  border-top: 1px solid #dcebf6;
  padding-top: 0.7rem;

  h3 {
    margin: 0 0 0.35rem;
    font-size: 0.85rem;
    color: #2d9fe2;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  li {
    border: 1px solid #bfd8ea;
    border-radius: 999px;
    padding: 0.12rem 0.55rem;
    font-size: 0.72rem;
    color: #5d7a8f;
  }
}

.bet-controls {
  margin-bottom: 1rem;
  border: 1px solid #dcebf6;
  border-radius: 8px;
  padding: 0.7rem;
}

.play-name {
  margin: 0 0 0.6rem;
  text-align: center;
  color: #4e4e4e;
  font-size: 0.85rem;
}

.bet-row {
  display: grid;
  gap: 0.42rem;
  margin-bottom: 0.62rem;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    color: #4a7088;
    font-size: 0.78rem;
    font-weight: 700;
  }

  input {
    border: 1px solid #c8deed;
    border-radius: 6px;
    padding: 0.32rem 0.45rem;
    color: #5d7486;
    font-size: 0.82rem;
  }
}

.custom-row {
  margin-bottom: 0.8rem;
}

.quick-amount {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;

  button {
    border: 1px solid #b9d7ec;
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
    background: #fff;
    color: #5f7f95;
    font-size: 0.72rem;
    cursor: pointer;
  }
}

.custom-input {
  display: flex;
  gap: 0.42rem;

  input {
    flex: 1;
  }

  button {
    border: 1px solid #b9d7ec;
    border-radius: 6px;
    padding: 0.28rem 0.58rem;
    background: #fff;
    color: #2d9fe2;
    cursor: pointer;
  }
}

.submit-block {
  margin-top: 0.9rem;
  border-top: 1px solid #dcebf6;
  padding-top: 0.65rem;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  color: #5d7486;
  font-size: 0.8rem;
  margin-bottom: 0.6rem;
}

.bottom-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.amount-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #5d7486;
  font-size: 0.75rem;

  input {
    width: 96px;
    border: 1px solid #c8deed;
    border-radius: 6px;
    padding: 0.25rem 0.4rem;
    color: #5d7486;
  }
}

.reset-btn {
  border: 1px solid #cfd6de;
  background: #fff;
  color: #607080;
  font-weight: 700;
  padding: 0.36rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
}

.submit-btn {
  border: 1px solid #2d9fe2;
  background: #2d9fe2;
  color: #fff;
  font-weight: 700;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.message,
.error,
.order-id,
.order-count {
  margin: 0.45rem 0 0;
  font-size: 0.78rem;
}

.message {
  color: #2d9fe2;
}

.error {
  color: #2f6d96;
}

.order-id,
.order-count {
  color: #5d7486;
}
</style>
