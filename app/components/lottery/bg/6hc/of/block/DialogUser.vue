<script setup lang="ts">
import { actions } from '~/utils/common'

defineProps<{
  visible: boolean
  data: {
    jackpot: { currentIssueJackpot: number; carryJackpot: number }
    claimableIssues: unknown[]
    isSubmittingClaim: boolean
    isLoading: boolean
    errorMessage: string
    balanceChanges: { id: string | number; createdAt: number; issue: string; type: string; amount: number; after: number }[]
    betHistory: { orderId: string; issue: string; betCode: string[]; coin: number; winStatus: string; winAmount: number }[]
  }
}>()

const emit = defineEmits<{
  close: []
  claim: []
}>()

const activeTab = ref<'balance' | 'bets'>('balance')
</script>

<template>
  <div v-if="visible" class="user-dialog-mask" @click.self="emit('close')">
    <section class="user-dialog">
      <header class="user-dialog-header">
        <h3>會員資產 / 下注紀錄</h3>
        <button type="button" class="close-btn" @click="emit('close')">×</button>
      </header>

      <div class="user-dialog-summary">
        <div>當期累積獎金：{{ actions.thousands(data.jackpot.currentIssueJackpot) }}</div>
        <div>累積滾存獎金：{{ actions.thousands(data.jackpot.carryJackpot) }}</div>
        <div>可領獎期數：{{ data.claimableIssues.length }}</div>
        <button type="button" class="claim-btn" :disabled="data.claimableIssues.length === 0 || data.isSubmittingClaim"
          @click="emit('claim')">
          {{ data.isSubmittingClaim ? '領獎中...' : '領取中獎獎金' }}
        </button>
      </div>

      <div v-if="data.isLoading" class="user-dialog-loading">載入中...</div>
      <div v-else-if="data.errorMessage" class="user-dialog-error">{{ data.errorMessage }}</div>
      <div v-else class="user-dialog-body">
        <div class="dialog-tabs">
          <button type="button" class="dialog-tab" :class="{ active: activeTab === 'balance' }"
            @click="activeTab = 'balance'">
            餘額變動表
          </button>
          <button type="button" class="dialog-tab" :class="{ active: activeTab === 'bets' }"
            @click="activeTab = 'bets'">
            下注紀錄
          </button>
        </div>

        <div class="dialog-tab-content">
          <!-- 餘額變動表 -->
          <section v-if="activeTab === 'balance'" class="dialog-block">
            <div class="dialog-table-wrap">
              <table class="report-table dialog-report-table">
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>期數</th>
                    <th>類型</th>
                    <th>變動</th>
                    <th>餘額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in data.balanceChanges" :key="item.id">
                    <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
                    <td>{{ item.issue }}</td>
                    <td>{{ item.type }}</td>
                    <td>{{ actions.thousands(item.amount) }}</td>
                    <td>{{ actions.thousands(item.after) }}</td>
                  </tr>
                  <tr v-if="data.balanceChanges.length === 0">
                    <td colspan="5" class="no-records">暫無資料</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- 下注紀錄 -->
          <section v-if="activeTab === 'bets'" class="dialog-block">
            <div class="dialog-table-wrap">
              <table class="report-table dialog-report-table">
                <thead>
                  <tr>
                    <th>訂單</th>
                    <th>期數</th>
                    <th>號碼</th>
                    <th>金額</th>
                    <th>中獎</th>
                    <th>獎金</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in data.betHistory" :key="item.orderId">
                    <td>{{ item.orderId }}</td>
                    <td>{{ item.issue }}</td>
                    <td>
                      <div class="bet-balls">
                        <LotteryBg6hcOfBaseBall v-for="code in item.betCode" :key="code"
                          :data="{ label: +code, num: +code }" :isClick="false" />
                      </div>
                    </td>
                    <td>{{ actions.thousands(item.coin) }}</td>
                    <td>{{ item.winStatus }}</td>
                    <td>{{ actions.thousands(item.winAmount) }}</td>
                  </tr>
                  <tr v-if="data.betHistory.length === 0">
                    <td colspan="6" class="no-records">暫無資料</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.user-dialog {
  .user-dialog-header {
    position: relative;

    .close-btn {
      font-size: 25px;
      position: absolute;
      top: -3px;
      right: 5px;
    }
  }

  .dialog-tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .dialog-tab {
    border: 1px solid #f3b7bf;
    border-radius: 0.25rem;
    background: #fff5f6;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main);
    cursor: pointer;

    &.active {
      background: var(--color-red-main);
      border-color: var(--color-red-main);
      color: #fff;
    }
  }

  .dialog-tab-content {
    overflow: hidden;
  }

  .claim-btn {
    padding: 6px 16px;
    border-radius: 0.25rem;
    border: 1px solid var(--color-red-main);
    background: var(--color-red-main);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;

    &:disabled {
      background: #f2f2f2;
      border-color: #cac7c7;
      color: #bfb5b5;
      cursor: not-allowed;
    }
  }

  .bet-balls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    justify-content: center;
    padding: 0.3rem 0;

    :deep(.ball-wrapper) {
      .ball {
        width: 2.4rem;
        height: 2.4rem;
        font-size: 1.2rem;
      }
    }
  }

}
</style>
