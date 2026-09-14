<script setup lang="ts">
import DialogShell from '~/components/lottery/tw/dlt/block/DialogShell.vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <DialogShell :visible="props.visible" title="玩法說明" @close="emit('close')">
    <div class="dlt-rule">
      <h4>基本規則</h4>
      <p>從 1~49 選出 6 個不重複號碼為一組，每組固定 50 coin。一次送單最多可填 A~E 共 5 組，
        每組各自獨立判定與派彩，不是複式（不會自動展開組合）。</p>

      <h4>開獎與獎金</h4>
      <p><strong>開獎號碼與 8 個獎項的派彩金額，完全鏡射台灣彩券官方大樂透當期實際結果</strong>，
        本站不自建隨機開獎、不自建賠率公式、不做彩池。下注當下不會顯示獎金金額，
        要等官方開獎、本站完成結算後，才會在「我的紀錄」顯示實際派彩。</p>

      <h4>8 個獎項對中條件</h4>
      <table class="dlt-rule-table">
        <tbody>
          <tr><td>頭獎</td><td>對中 6 個號碼</td></tr>
          <tr><td>二獎</td><td>對中 5 個號碼＋特別號</td></tr>
          <tr><td>三獎</td><td>對中 5 個號碼</td></tr>
          <tr><td>四獎</td><td>對中 4 個號碼＋特別號</td></tr>
          <tr><td>五獎</td><td>對中 4 個號碼</td></tr>
          <tr><td>六獎</td><td>對中 3 個號碼＋特別號</td></tr>
          <tr><td>七獎</td><td>對中 3 個號碼</td></tr>
          <tr><td>普獎</td><td>對中 2 個號碼＋特別號</td></tr>
        </tbody>
      </table>

      <h4>開獎週期</h4>
      <p>比照官方：每週二、五開獎，當日 20:00 截止投注、20:30 開獎。開獎後本站會等待官方公布
        完整開獎號與獎金明細才結算，可能需要一些時間，結算完成前注單會顯示「結算中」。</p>
    </div>
  </DialogShell>
</template>

<style scoped lang="scss">
.dlt-rule {
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-red-desc, #6b7280);

  h4 {
    margin: 0.75rem 0 0.25rem;
    color: var(--color-red-main);
    font-size: 13px;
  }

  p {
    margin: 0 0 0.5rem;
  }
}

.dlt-rule-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  td {
    border-bottom: 1px solid #fee2e2;
    padding: 4px 6px;
  }

  td:first-child {
    font-weight: 700;
    color: var(--color-red-main);
    width: 60px;
  }
}
</style>
