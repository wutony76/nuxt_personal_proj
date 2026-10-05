<script setup lang="ts">
/**
 * 遊戲試算（/admin/game-simulator）：刮刮樂 model03（剪刀石頭布）機率/派彩驗證工具。
 * 純模擬運算，不扣款、不派彩，見 add-scratch-model03-simulator。
 *
 * model03 的機率表移植自外部 Python 專案 py3_AVScratch_proj，目前只做了這一個 model——
 * 其餘 8 個 model 之後視需要再擴充，不在本次範圍內。
 *
 * 卡片視覺還原（底圖＋手勢/金額圖示疊圖）見 AdminScratchModel03Card.vue，純文字版的
 * 回合明細表格保留在卡片視覺下方，給需要精確核對數字的情境用。
 */
import { reactive } from 'vue'
import { api, type ScratchModel03Card } from '~/services/api'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

const WIN_COIN_OPTIONS = [600000, 60000, 10000, 5000, 1500, 800, 500, 300, 200, 100, 0]

const state = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  cardWinCoin: 1500,
  count: 10,
  elapsedMs: 0,
  cards: [] as ScratchModel03Card[]
})

const _actions = {
  run: async () => {
    if (state.status === 'loading') return
    state.status = 'loading'
    state.error = ''
    try {
      const res = await api.admin.gameSimulator.scratchModel03({
        cardWinCoin: state.cardWinCoin,
        count: state.count
      })
      state.cards = res.cards
      state.elapsedMs = res.elapsedMs
      state.status = 'success'
    } catch (e: unknown) {
      state.error = (e as { message?: string })?.message ?? '試算失敗'
      state.status = 'error'
    }
  }
}

const click = {
  run: () => _actions.run()
}
</script>

<template>
  <AdminShell active="gamemgmt" kicker="Simulator" title="遊戲試算" desc="刮刮樂 model03（剪刀石頭布）機率/派彩驗證，純模擬不扣款。">
    <div class="ags-layout">
      <AdminGameNav active="simulator" />
      <div class="ags-content">
        <div class="ags-rule admin-panel">
          <p>玩法說明：刮開任一局，若「您的猜拳」勝過「對手猜拳」，即得該局對應的獎金（不可跨局對獎）；若平手，則該局可得對應獎金的一半。</p>
          <p class="ags-rule-note">
            ⚠️ 忠實移植自原始系統的已知落差：原始程式碼裡「贏」這個狀態實際上永遠不會產生非零的「得到金額」
            （猜拳規則下「贏」必然雙方手勢不同，只有「平手」手勢才會相同），所以下方結果裡紅字（原本判定為贏/平手）
            的回合，「得到金額」欄位只有在雙方手勢真的相同（平手）時才會是非零值。這不是本次移植新增的 bug，
            是原始系統既有的行為，刻意保留不擅自修正。
          </p>
        </div>

        <div class="ags-form">
          <div class="admin-field">
            <label>目標金額</label>
            <select v-model.number="state.cardWinCoin" class="admin-input">
              <option v-for="coin in WIN_COIN_OPTIONS" :key="coin" :value="coin">{{ coin.toLocaleString('zh-TW') }}</option>
            </select>
          </div>
          <div class="admin-field">
            <label>模擬張數</label>
            <input v-model.number="state.count" type="number" min="1" max="50" class="admin-input" />
          </div>
          <button type="button" class="admin-btn admin-btn-primary ags-run-btn" @click="click.run()">
            {{ state.status === 'loading' ? '試算中…' : '隨機試算' }}
          </button>
        </div>

        <div v-if="state.status === 'error'" class="admin-empty" style="color:#b91c1c">{{ state.error }}</div>
        <div v-else-if="state.status === 'idle'" class="admin-empty">設定好目標金額與張數後按「隨機試算」。</div>

        <template v-else-if="state.status === 'success'">
          <div class="ags-meta">共 {{ state.cards.length }} 張，耗時 {{ state.elapsedMs }}ms</div>

          <div v-for="(card, cardIdx) in state.cards" :key="cardIdx" class="ags-card admin-panel">
            <div class="ags-card-head">
              <span class="admin-en">Card #{{ cardIdx + 1 }}</span>
              <span class="ags-card-target">目標金額：{{ card.winCoin.toLocaleString('zh-TW') }}</span>
            </div>

            <AdminScratchModel03Card class="ags-card-visual" :card="card" />

            <div class="ags-rounds">
              <div v-for="(round, roundIdx) in card.rounds" :key="roundIdx" class="ags-round" :class="round.color">
                <div class="ags-round-title">{{ round.title }}</div>
                <div class="ags-round-play">{{ round.play[0] }} vs {{ round.play[1] }}</div>
                <div class="ags-round-coin">面額：{{ round.coin.toLocaleString('zh-TW') }}</div>
                <div class="ags-round-get">得到：{{ round.getCoin.toLocaleString('zh-TW') }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </AdminShell>
</template>

<style scoped lang="scss">
.ags-layout {
  display: flex;
  flex-direction: column;
}

.ags-content {
  flex: 1;
  min-width: 0;
}

.ags-rule {
  margin-bottom: 20px;
  padding: 14px 18px;
  font-size: 13px;
  line-height: 1.7;

  p {
    margin: 0 0 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.ags-rule-note {
  color: var(--muted, #6b7280);
  font-size: 12px;
}

.ags-form {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 20px;
}

.ags-run-btn {
  height: 38px;
}

.ags-meta {
  margin-bottom: 14px;
  font-size: 12.5px;
  color: var(--muted, #6b7280);
}

.ags-card {
  margin-bottom: 16px;
  padding: 14px 18px;
}

.ags-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
}

.ags-card-visual {
  margin-bottom: 14px;
}

.ags-card-target {
  font-weight: 700;
}

.ags-rounds {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ags-round {
  border: 1px solid var(--line, #e5e7eb);
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;

  &.red {
    color: #b91c1c;
    border-color: #b91c1c;
  }

  &.black {
    color: inherit;
  }
}

.ags-round-title {
  font-weight: 700;
  margin-bottom: 4px;
}
</style>
