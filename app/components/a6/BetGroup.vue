<script setup lang="ts">
import { use6hcOfficial } from '~/composables/use6hcOfficial'

const a6 = use6hcOfficial()
</script>

<template>
  <div class="block-bets-group">
    <div class="toolbar">
      <button type="button" @click="a6.randomPick">隨機</button>
      <button type="button" @click="a6.resetCurrentPicks">清號</button>
    </div>

    <div class="inputs">
      <label>金額<input v-model.number="a6.state.amount" type="number" min="1" /></label>
      <label>倍數<input v-model.number="a6.state.multiplier" type="number" min="1" /></label>
      <label>期數<input v-model.number="a6.state.issueCount" type="number" min="1" /></label>
    </div>

    <div class="preview">
      <p>預覽：{{ a6.currentPreviewCode }}</p>
      <p>注數：{{ a6.currentBetCount }}</p>
    </div>

    <div class="action-row">
      <button type="button" @click="a6.addBetRow">加入注單</button>
      <button type="button" class="submit" @click="a6.submitBet">確認投注</button>
      <button type="button" @click="a6.clearRows">清空</button>
    </div>

    <ul class="bet-list">
      <li v-for="row in a6.state.rows" :key="row.id">
        <span>{{ row.mode }}</span>
        <span>{{ row.code }}</span>
        <span>{{ row.count }} 注</span>
        <span>${{ row.amount }}</span>
      </li>
      <li v-if="a6.state.rows.length === 0" class="empty">尚無注單</li>
    </ul>

    <p class="total">合計：${{ a6.totalMoney }}</p>
    <p v-if="a6.state.message" class="message">{{ a6.state.message }}</p>
  </div>
</template>

<style scoped lang="scss">
.block-bets-group {
  padding: 0;
}

.toolbar,
.action-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 20px 0;
}

button {
  border: 1px solid #dfe6ec;
  border-radius: 0.25rem;
  background: #fff;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  color: #797979;
}

.submit {
  background: #20a0ff;
  color: #fff;
  border-color: #20a0ff;
}

.inputs {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 20px;

  label {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: #888;
    font-weight: 700;
  }

  input {
    width: 86px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 4px 8px;
  }
}

.preview {
  margin-top: 10px;
  padding: 0 20px;

  p {
    margin: 0 0 4px;
    font-size: 12px;
    color: #334155;
  }
}

.bet-list {
  margin: 10px 0 0;
  padding: 0 20px;
  list-style: none;
  max-height: 230px;
  overflow: auto;
  border-top: 1px solid #e1e1e1;
  border-bottom: 1px solid #e1e1e1;

  li {
    border-bottom: 1px solid #e1e1e1;
    padding: 7px 0;
    display: grid;
    grid-template-columns: 0.8fr 1.6fr 0.7fr 0.7fr;
    gap: 6px;
    font-size: 12px;
    color: #334155;
  }

  .empty {
    display: block;
    text-align: center;
    color: #94a3b8;
    padding: 16px 0;
  }
}

.total {
  margin: 0;
  padding: 10px 20px 0;
  font-size: 13px;
  font-weight: 800;
}

.message {
  margin: 8px 0 0;
  padding: 0 20px 20px;
  color: #0b83db;
  font-size: 12px;
  font-weight: 700;
}
</style>
