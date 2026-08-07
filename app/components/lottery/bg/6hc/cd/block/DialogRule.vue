<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CREDIT_JACKPOT,
  CREDIT_TEMA_ODDS,
  CREDIT_TIE_SPECIAL_NUMBER,
  CREDIT_ZHENGMA_NORMAL_COUNT,
  CREDIT_ZHENGMA_ODDS,
  CREDIT_ZHENGMA_SUM_LINE
} from '#shared/config/6hc-cd'
import C_PLAYS from '#shared/config/cd/plays'
import { creditQuotaOf } from '#shared/config/cd/helpers'
import { actions } from '~/utils/common'
import { use6hcCredit } from '~/composables/use6hcCredit'

const SAMPLE_COIN = 10 // 派彩範例的注金

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { jackpot: mxJackpot, livePool: mxLivePool } = use6hcCredit()

const dialogEl = ref<HTMLElement | null>(null)

const NAV_ITEMS = [
  { id: 'cd-section-intro', label: '遊戲簡介' },
  { id: 'cd-section-timeline', label: '時間流程' },
  { id: 'cd-section-play', label: '投注玩法' },
  { id: 'cd-section-prize', label: '獎金結構' },
  { id: 'cd-section-jackpot', label: '獎池滾存' },
  { id: 'cd-section-note', label: '特別說明' },
]

// 每期 7 分鐘（server lotteryBase timer.getStatusBySeconds）
const TIMELINE = [
  { range: '0 — 30 秒', status: '準備中', desc: '當期開始，尚未開盤' },
  { range: '30 秒 — 5 分 40 秒', status: '開盤中', desc: '可投注區間（約 5 分 10 秒）' },
  { range: '5 分 40 秒 — 5 分 50 秒', status: '已封盤', desc: '停止接受投注' },
  { range: '5 分 50 秒 — 6 分 00 秒', status: '準備開獎', desc: '系統整理當期注單' },
  { range: '6 分 00 秒 — 6 分 40 秒', status: '正在開獎中', desc: '依序攪出 7 顆號碼（6 正碼＋特別號）' },
  { range: '6 分 40 秒 後', status: '已開獎', desc: '逐注結算派彩，可查閱結果' },
]

// 可投注玩法（與 shared/config 的賠率表、伺端結算邏輯同一份來源）
const PLAY_TYPES = [
  {
    key: 'number',
    name: '特碼單號',
    odds: CREDIT_TEMA_ODDS.number,
    rule: '所選號碼 = 特別號',
    desc: '從 01 — 49 選號，開出的特別號與所選號碼相同即中獎。',
    example: '例：選 07，特別號開 07 → 中獎',
  },
  {
    key: 'side',
    name: '特碼兩面',
    odds: CREDIT_TEMA_ODDS.side,
    rule: '特大／特小、特單／特雙、合單／合雙、尾大／尾小',
    desc: '特大 ≥ 25、特小 ≤ 24；單雙看奇偶；合數為十位＋個位；尾大 ≥ 5、尾小 ≤ 4。',
    example: `例：特別號 31 → 特大、特單、合雙（3+1=4）、尾小（尾 1）皆中`,
  },
  {
    key: 'color',
    name: '特碼色波',
    odds: `${CREDIT_TEMA_ODDS.colorRed} / ${CREDIT_TEMA_ODDS.colorBlue} / ${CREDIT_TEMA_ODDS.colorGreen}`,
    rule: '紅波 / 藍波 / 綠波',
    desc: '依特別號所屬色波判定（紅波 17 個號、藍波與綠波各 16 個號）。',
    example: '例：特別號 31 屬藍波 → 投注藍波中獎',
  },
]

// 正碼玩法（判定看 6 顆正碼與七球總和，與特碼的「只看特別號」不同）
const ZHENGMA_PLAY_TYPES = [
  {
    key: 'zhengma-number',
    name: '正碼單號',
    odds: CREDIT_ZHENGMA_ODDS.number,
    rule: `所選號碼命中 ${CREDIT_ZHENGMA_NORMAL_COUNT} 顆正碼之一`,
    desc: `從 01 — 49 選號，開出的前 ${CREDIT_ZHENGMA_NORMAL_COUNT} 顆正碼中出現所選號碼即中獎，特別號不算。`,
    example: '例：選 07，正碼開 07 → 中獎；只有特別號開 07 → 未中',
  },
  {
    key: 'zhengma-side',
    name: '總和兩面',
    odds: CREDIT_ZHENGMA_ODDS.side,
    rule: '總和大／總和小、總和單／總和雙',
    desc: `以 7 顆號碼（6 正碼＋特別號）相加的總和判定：≥ ${CREDIT_ZHENGMA_SUM_LINE} 為大、≤ ${CREDIT_ZHENGMA_SUM_LINE - 1} 為小；單雙看總和奇偶。`,
    example: '例：開 02,03,08,23,29,35＋30 → 總和 130 → 總和小、總和雙皆中',
  },
]

const PRIZE_ROWS = [
  { name: '特碼單號', condition: '號碼 = 特別號', odds: CREDIT_TEMA_ODDS.number, hint: '49 選 1，理論值 49' },
  { name: '特碼兩面', condition: '大小／單雙／合單雙／尾大小', odds: CREDIT_TEMA_ODDS.side, hint: `開 ${CREDIT_TIE_SPECIAL_NUMBER} 號為和局，退還本金` },
  { name: '紅波', condition: '特別號屬紅波（17 個號）', odds: CREDIT_TEMA_ODDS.colorRed, hint: '理論值 2.88' },
  { name: '藍波', condition: '特別號屬藍波（16 個號）', odds: CREDIT_TEMA_ODDS.colorBlue, hint: '理論值 3.06' },
  { name: '綠波', condition: '特別號屬綠波（16 個號，含 49）', odds: CREDIT_TEMA_ODDS.colorGreen, hint: '理論值 3.06' },
  { name: '正碼單號', condition: `號碼命中 ${CREDIT_ZHENGMA_NORMAL_COUNT} 顆正碼之一`, odds: CREDIT_ZHENGMA_ODDS.number, hint: `49 選 ${CREDIT_ZHENGMA_NORMAL_COUNT}，理論值 8.17` },
  { name: '總和兩面', condition: `七球總和 大／小（界 ${CREDIT_ZHENGMA_SUM_LINE}）、單／雙`, odds: CREDIT_ZHENGMA_ODDS.side, hint: '不設和局' },
]

// 各分頁的賠率與限額：直接讀 c_tema / c_zhengma 設定，config 調整後說明頁自動跟上
const TAB_ROWS = (C_PLAYS as Array<{ name?: string; key?: string; list?: Array<Record<string, any>> }>)
  .flatMap((play) => (play.list ?? []).map((tab) => {
    const quota = creditQuotaOf(play.key, tab.tabId)
    // 各群組取第一個注項的賠率當代表（同群組賠率相同）
    const odds = (tab.tabGroup ?? []).map((group: any) => ({
      groupName: String(group?.groupName ?? ''),
      odds: Number(group?.groupList?.[0]?.odds ?? 0),
    })).filter((item: { odds: number }) => item.odds > 0)
    return {
      playName: String(play.name ?? play.key ?? ''),
      tabName: String(tab.tabName ?? ''),
      itemMin: quota.item.min,
      itemMax: quota.item.max,
      issueMax: quota.issue.max,
      odds,
    }
  }))

// --- COMPUTED ---
const totalPool = computed(() => mxLivePool.value)
const currentIssuePool = computed(() => Number(mxJackpot.currentIssueJackpot ?? 0))
const carryPool = computed(() => Number(mxJackpot.carryJackpot ?? 0))
// 可發放累積池（當期抽水 + 累積滾存，不含展示用池底）
const distributablePool = computed(() => Number(mxJackpot.distributable ?? 0))
const estimatedPayout = computed(() => Number((distributablePool.value * CREDIT_JACKPOT.payoutRatio).toFixed(2)))
const lastHit = computed(() => mxJackpot.lastHit)
// 爆池分配權重（依注項類別）
const JACKPOT_WEIGHTS = [
  { name: `特碼單號 ${CREDIT_JACKPOT.hitNumber}`, result: '中獎', weight: CREDIT_JACKPOT.weights.number },
  { name: '綠波', result: `中獎（${CREDIT_JACKPOT.hitNumber} 屬綠波）`, weight: CREDIT_JACKPOT.weights.color },
  { name: '特碼兩面（8 項）', result: `和局（開 ${CREDIT_JACKPOT.hitNumber} 必和局）`, weight: CREDIT_JACKPOT.weights.side },
  { name: '其他單號 / 紅波 / 藍波', result: '未中', weight: 0 },
]

// --- HANDLE ---
const _handlers = {
  payoutOf: (odds: number) => Number((SAMPLE_COIN * odds).toFixed(2)),
  profitOf: (odds: number) => Number((SAMPLE_COIN * odds - SAMPLE_COIN).toFixed(2)),
}

const click = {
  scrollTo: (id: string) => {
    const container = dialogEl.value
    const target = container?.querySelector<HTMLElement>(`#${id}`)
    if (!container || !target) return
    container.scrollTo({ top: target.offsetTop - container.offsetTop - 8, behavior: 'smooth' })
  },
  backTop: () => {
    dialogEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
  },
}
</script>

<template>
  <div v-if="visible" class="cd-rule-mask" @click.self="emit('close')">
    <section ref="dialogEl" class="cd-rule-dialog">
      <header class="cd-rule-header">
        <h3>遊戲說明 — 六合彩信用玩法</h3>
        <button type="button" class="close-btn" @click="emit('close')">×</button>
      </header>

      <nav class="cd-rule-nav">
        <button v-for="item in NAV_ITEMS" :key="item.id" type="button" class="cd-rule-nav-btn"
          @click="click.scrollTo(item.id)">
          {{ item.label }}
        </button>
      </nav>

      <div class="cd-rule-body">
        <!-- 遊戲簡介 -->
        <div id="cd-section-intro" class="rule-section">
          <h4 class="rule-title">遊戲簡介</h4>
          <ul class="rule-list">
            <li>從 <strong>01 — 49</strong> 共 49 顆號碼中，每期隨機攪出 <strong>7 顆</strong>（6 正碼＋1 特別號）。</li>
            <li>每日共 <strong>205 期</strong>，每 <strong>7 分鐘</strong> 開獎一次。</li>
            <li>信用玩法為 <strong>每注獨立、按賠率派彩</strong>；結算依玩法而定 —
              <strong>特碼</strong>看第 7 顆特別號，<strong>正碼</strong>看前
              {{ CREDIT_ZHENGMA_NORMAL_COUNT }} 顆正碼與七球總和。
            </li>
            <li>與官方玩法的差異：官方是「一注 6 顆號碼、依命中數分層領獎池」，信用玩法是「一注一個注項、中獎即按賠率派彩」。</li>
          </ul>
        </div>

        <!-- 時間流程 -->
        <div id="cd-section-timeline" class="rule-section">
          <h4 class="rule-title">時間流程（每期共 7 分鐘）</h4>
          <div class="rule-table-wrap">
            <table class="rule-table">
              <colgroup>
                <col style="width: 34%" />
                <col style="width: 20%" />
                <col style="width: 46%" />
              </colgroup>
              <thead>
                <tr>
                  <th>時間節點</th>
                  <th>狀態</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in TIMELINE" :key="item.status">
                  <td class="td-range">{{ item.range }}</td>
                  <td><span class="status-badge" :class="`status-${item.status}`">{{ item.status }}</span></td>
                  <td>{{ item.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 投注玩法 -->
        <div id="cd-section-play" class="rule-section">
          <h4 class="rule-title">投注玩法</h4>
          <p class="rule-note">
            目前開放「<strong>特碼</strong>」與「<strong>正碼</strong>」兩種玩法，各自分為
            <strong>A / B</strong> 兩個分頁（同玩法的分頁注項相同，注單會記錄所屬分頁）。
          </p>

          <p class="rule-sub-title">特碼 — 以第 7 顆特別號結算</p>
          <div class="play-cards">
            <div v-for="play in PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
              <p class="play-card-example">{{ play.example }}</p>
            </div>
          </div>

          <p class="rule-sub-title">正碼 — 以 {{ CREDIT_ZHENGMA_NORMAL_COUNT }} 顆正碼與七球總和結算</p>
          <div class="play-cards">
            <div v-for="play in ZHENGMA_PLAY_TYPES" :key="play.key" class="play-card">
              <div class="play-card-head">
                <span class="play-card-name">{{ play.name }}</span>
                <span class="play-card-odds">賠率 {{ play.odds }}</span>
              </div>
              <p class="play-card-rule">{{ play.rule }}</p>
              <p class="play-card-desc">{{ play.desc }}</p>
              <p class="play-card-example">{{ play.example }}</p>
            </div>
          </div>
          <p class="rule-sub-title">各分頁賠率與投注限額</p>
          <div class="rule-table-wrap">
            <table class="rule-table">
              <thead>
                <tr>
                  <th>玩法 / 分頁</th>
                  <th>賠率</th>
                  <th>單注金額</th>
                  <th>單期上限</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in TAB_ROWS" :key="`${row.playName}-${row.tabName}`">
                  <td class="tier-name">{{ row.playName }} · {{ row.tabName }}</td>
                  <td class="tier-odds">
                    <span v-for="item in row.odds" :key="item.groupName" class="odds-chip">
                      {{ item.groupName }} {{ item.odds }}
                    </span>
                  </td>
                  <td class="tier-est">{{ actions.money(row.itemMin) }} — {{ actions.money(row.itemMax) }}</td>
                  <td class="tier-hint">{{ row.issueMax > 0 ? actions.money(row.issueMax) : '不限' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul class="rule-list rule-list-tight">
            <li>同玩法的 <strong>A / B 分頁注項相同但賠率與限額不同</strong>（B 盤為大額投注，額度較高、賠率較低），
              下注時的賠率會鎖定在注單上。</li>
            <li><strong>單注金額</strong>需在該分頁區間內，<strong>單期上限</strong>以「同一期、同一分頁」累計計算，超限整筆不受理。</li>
            <li>每注可<strong>獨立設定金額</strong>，總扣款 = 各注金額加總，<strong>下注即扣款</strong>。</li>
            <li><strong>隨機選號</strong>：可指定注數由系統機選號碼球，或一鍵清空。</li>
            <li><strong>號碼推薦</strong>：依「攪出次數 / 相隔期數」落差推薦 6 碼，可一鍵加入注項。</li>
            <li><strong>自動投注</strong>：開啟後每期開盤自動隨機下注指定注數，餘額不足會自動跳過該期。</li>
          </ul>
        </div>

        <!-- 獎金結構 -->
        <div id="cd-section-prize" class="rule-section">
          <h4 class="rule-title">獎金結構</h4>
          <p class="rule-note">
            派彩 = <strong>注金 × 賠率</strong>，<strong>賠率含本金</strong>（下注時已扣款）。<br>
            以下派彩範例以每注 {{ SAMPLE_COIN }} 元計算。
          </p>
          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 18%" />
                <col style="width: 30%" />
                <col style="width: 12%" />
                <col style="width: 18%" />
                <col style="width: 22%" />
              </colgroup>
              <thead>
                <tr>
                  <th>玩法</th>
                  <th>中獎條件</th>
                  <th>賠率</th>
                  <th>{{ SAMPLE_COIN }} 元派彩</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in PRIZE_ROWS" :key="row.name">
                  <td class="tier-name">{{ row.name }}</td>
                  <td class="tier-match">{{ row.condition }}</td>
                  <td class="tier-odds">{{ row.odds }}</td>
                  <td class="tier-est">
                    {{ actions.money(_handlers.payoutOf(row.odds)) }}
                    <span class="tier-profit">（淨利 {{ actions.money(_handlers.profitOf(row.odds)) }}）</span>
                  </td>
                  <td class="tier-hint">{{ row.hint }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="rule-list rule-list-tight">
            <li>結算後派彩會進入<strong>可領獎金</strong>，需在「下注紀錄」點選「<strong>領取中獎獎金</strong>」才會入帳。</li>
            <li>領獎<strong>一次領一期</strong>，由最早未領取的期數開始。</li>
            <li>和局（退還本金）同樣列入可領金額。</li>
          </ul>
        </div>

        <!-- 獎池滾存 -->
        <div id="cd-section-jackpot" class="rule-section">
          <h4 class="rule-title">獎池、滾存與爆池發放</h4>
          <ul class="rule-list">
            <li>賠率派彩由莊家支付，<strong>不從獎池扣款</strong>；獎池改由每筆投注<strong>抽水
                {{ (CREDIT_JACKPOT.rakeRatio * 100).toFixed(0) }}%</strong> 累積。</li>
            <li><strong>爆池期</strong>：特別號開出 <strong>{{ CREDIT_JACKPOT.hitNumber }}</strong> 時發放，
              發放金額 = 可發放累積池 × <strong>{{ (CREDIT_JACKPOT.payoutRatio * 100).toFixed(0) }}%</strong>，其餘滾存至下期。</li>
            <li>可發放累積池 = <strong>當期抽水 ＋ 累積滾存</strong>（不含頁首展示用的池底金額）。</li>
            <li>累積池未達 <strong>{{ actions.money(CREDIT_JACKPOT.minPool) }}</strong> 或該期無人有份時<strong>不發放</strong>，整池滾存至下期。
            </li>
            <li>爆池期由該期<strong>有份的注單依「注金 × 權重」比例分配</strong>，兩面與色波同樣參與（見下表）。</li>
            <li>加碼金額與賠率派彩合併計入該期<strong>可領獎金</strong>，於「下注紀錄」一併領取。</li>
          </ul>

          <div class="rule-table-wrap">
            <table class="rule-table prize-table">
              <colgroup>
                <col style="width: 34%" />
                <col style="width: 40%" />
                <col style="width: 26%" />
              </colgroup>
              <thead>
                <tr>
                  <th>注項類別</th>
                  <th>爆池期（特別號 {{ CREDIT_JACKPOT.hitNumber }}）結果</th>
                  <th>分配權重</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in JACKPOT_WEIGHTS" :key="row.name">
                  <td class="tier-name">{{ row.name }}</td>
                  <td class="tier-match">{{ row.result }}</td>
                  <td class="tier-odds">{{ row.weight > 0 ? `× ${row.weight}` : '無份' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pool-rows">
            <div class="pool-row">
              <span class="pool-label">當期抽水</span>
              <span class="pool-value pool-value-current">{{ actions.money(currentIssuePool) }} F幣</span>
            </div>
            <div class="pool-row">
              <span class="pool-label">累積滾存</span>
              <span class="pool-value pool-value-base">{{ actions.money(carryPool) }} F幣</span>
            </div>
            <div class="pool-row">
              <span class="pool-label">可發放累積池</span>
              <span class="pool-value">{{ actions.money(distributablePool) }} F幣</span>
            </div>
            <div class="pool-row pool-row-total">
              <span class="pool-label">預估獎金</span>
              <span class="pool-value">{{ actions.money(estimatedPayout) }} F幣</span>
            </div>
          </div>
          <p class="rule-note">
            上次獎金：
            <template v-if="lastHit">
              <strong>第{{ lastHit.issue }}期</strong>，發放 <strong>{{ actions.money(lastHit.payout) }}</strong>，
              {{ lastHit.winners }} 人 / {{ lastHit.orders }} 注分配（該期累積池 {{ actions.money(lastHit.pool) }}）
            </template>
            <template v-else>尚未發放</template>
            ｜頁首「總獎金」= 池底（展示） ＋ 可發放累積池 = {{ actions.money(totalPool) }} F幣
          </p>
        </div>

        <!-- 特別說明 -->
        <div id="cd-section-note" class="rule-section rule-section-last">
          <h4 class="rule-title">特別說明</h4>
          <ul class="rule-list">
            <li>開出 <strong>{{ CREDIT_TIE_SPECIAL_NUMBER }}</strong> 號時，特碼兩面（大小／單雙／合單雙／尾大小）<strong>全部視為和局</strong>，退還本金。
            </li>
            <li><strong>色波不設和局</strong>：{{ CREDIT_TIE_SPECIAL_NUMBER }} 號屬綠波，投注綠波仍算中獎。</li>
            <li>每注<strong>獨立結算</strong>：特碼僅看特別號、與 6 顆正碼無關；正碼僅看
              {{ CREDIT_ZHENGMA_NORMAL_COUNT }} 顆正碼、與特別號無關（總和則含特別號）。</li>
            <li><strong>正碼不設和局</strong>：開出 {{ CREDIT_TIE_SPECIAL_NUMBER }} 號時，正碼單號命中照賠，
              總和兩面亦以總和大小單雙照常判定。</li>
            <li>封盤後送出的投注<strong>不予受理</strong>，請在開盤期間內完成下注。</li>
            <li>賠率可依營運需求調整，結算<strong>以下注時記錄在注單上的賠率為準</strong>（可於下注紀錄查閱）。</li>
            <li>尚未開放的玩法（生肖、五行、連碼等）若經由其他管道下注，結算時一律<strong>退還本金</strong>。</li>
            <li>開獎結果以系統公布為準，如對結果有疑問請聯繫客服。</li>
          </ul>
        </div>
      </div>

      <button type="button" class="back-top-btn" @click="click.backTop">↑ TOP</button>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* 樣式自帶（scoped）：避免與 6hc-of 頁的同名樣式互相覆蓋 */
.cd-rule-mask {
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.cd-rule-dialog {
  width: min(820px, 96vw);
  max-height: 88vh;
  overflow: auto;
  border: 4px solid #7f1d1d;
  border-radius: 8px;
  background: #fff;
  padding: 0.75rem;

  .cd-rule-header {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 14px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .close-btn {
      position: absolute;
      top: -3px;
      right: 5px;
      border: none;
      background: none;
      font-size: 25px;
      font-weight: 700;
      line-height: 1;
      color: var(--color-red-desc);
      cursor: pointer;

      &:hover {
        color: var(--color-red-main);
      }
    }
  }

  .cd-rule-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid #fee2e2;
    border-bottom: unset;
    border-radius: 6px 6px 0 0;
    background: #fff5f6;

    .cd-rule-nav-btn {
      border: 1px solid #f2b7c1;
      border-radius: 999px;
      background: #fff;
      padding: 3px 10px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-red-main);
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: var(--color-red-main);
        color: #fff;
      }
    }
  }

  .cd-rule-body {
    display: grid;
    gap: 18px;

    .rule-section {
      border: 1px solid #fee2e2;
      border-radius: 6px;
      padding: 12px 14px;

      &#cd-section-intro {
        border-radius: 0 0 6px 6px;
      }

      &.rule-section-last {
        margin-bottom: 4px;
      }
    }

    .rule-title {
      margin: 0 0 10px;
      border-left: 3px solid var(--color-red-main);
      padding-left: 8px;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .rule-note {
      margin: 0 0 8px;
      font-size: 12px;
      line-height: 1.6;
      color: var(--color-red-desc);

      strong {
        color: var(--color-red-main);
      }
    }

    .odds-chip {
      display: inline-block;
      margin: 0 4px 2px 0;
      padding: 1px 6px;
      border: 1px solid var(--color-gold);
      border-radius: 4px;
      font-size: 11px;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;
    }

    /* 同一章節內的玩法小標（特碼 / 正碼） */
    .rule-sub-title {
      margin: 12px 0 8px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      display: flex;
      align-items: center;
      gap: 6px;

      &::before {
        content: '';
        width: 4px;
        height: 12px;
        background: var(--color-gold);
      }
    }

    .rule-list {
      margin: 0;
      padding-left: 1.2rem;
      display: grid;
      gap: 5px;
      font-size: 13px;
      line-height: 1.55;
      color: #374151;

      strong {
        color: var(--color-red-main);
      }

      &.rule-list-tight {
        margin-top: 10px;
        font-size: 12px;
      }
    }

    /* 表格共用 */
    .rule-table-wrap {
      overflow-x: auto;
    }

    .rule-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;

      thead th {
        background: var(--color-red-main);
        padding: 6px 8px;
        text-align: center;
        white-space: nowrap;
        font-weight: 600;
        color: #fff;
      }

      tbody td {
        border-bottom: 1px solid #fee2e2;
        padding: 6px 8px;
        text-align: center;
        color: #374151;
      }

      tbody tr:last-child td {
        border-bottom: none;
      }

      tbody tr:hover td {
        background: #fff5f6;
      }
    }

    .td-range {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      font-weight: 600;
      color: var(--color-red-desc);
    }

    .status-badge {
      display: inline-block;
      border-radius: 0.25rem;
      padding: 1px 6px;
      font-size: 11px;
      font-weight: 600;
      background: #f3f4f6;
      color: #374151;

      &.status-開盤中 {
        background: #dcfce7;
        color: #15803d;
      }

      &.status-正在開獎中 {
        background: #fef9c3;
        color: #92400e;
      }

      &.status-已開獎 {
        background: #fee2e2;
        color: var(--color-red-main);
      }

      &.status-已封盤 {
        background: #f3f4f6;
        color: #6b7280;
      }
    }

    /* 玩法卡片 */
    .play-cards {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));

      .play-card {
        border: 1px solid #f3b7bf;
        border-radius: 6px;
        padding: 10px 12px;
        background: #fff5f6;

        .play-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 6px;

          .play-card-name {
            font-size: 13px;
            font-weight: 700;
            color: var(--color-red-main);
          }

          .play-card-odds {
            border: 1px solid #fbbf24;
            border-radius: 999px;
            background: #fffbeb;
            padding: 1px 8px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            color: #b45309;
          }
        }

        .play-card-rule {
          margin: 0 0 4px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-red-desc);
        }

        .play-card-desc {
          margin: 0 0 4px;
          font-size: 12px;
          line-height: 1.5;
          color: #374151;
        }

        .play-card-example {
          margin: 0;
          font-size: 11px;
          font-style: italic;
          color: var(--color-red-desc);
        }
      }
    }

    /* 獎金結構 */
    .prize-table {
      .tier-name {
        font-weight: 700;
        color: var(--color-red-main);
      }

      .tier-match {
        font-weight: 600;
      }

      .tier-odds {
        font-size: 14px;
        font-weight: 700;
        color: #d97706;
      }

      .tier-est {
        font-size: 13px;
        font-weight: 700;
        color: #15803d;

        .tier-profit {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
        }
      }

      .tier-hint {
        font-size: 11px;
        color: #6b7280;
      }
    }

    /* 獎池 */
    .pool-rows {
      display: grid;
      gap: 4px;
      margin-top: 10px;
      border: 1px solid #fde68a;
      border-radius: 6px;
      background: #fffbf0;
      padding: 8px 10px;

      .pool-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;

        .pool-label {
          font-weight: 600;
          color: var(--color-red-desc);
        }

        .pool-value {
          font-size: 13px;
          font-weight: 700;
          color: #d97706;

          &.pool-value-base {
            font-weight: 600;
            color: #6b7280;
          }

          &.pool-value-current {
            color: #15803d;
          }
        }

        &.pool-row-total {
          margin-top: 4px;
          border-top: 1px dashed #fde68a;
          padding-top: 6px;

          .pool-label {
            font-size: 13px;
            color: var(--color-red-main);
          }

          .pool-value {
            font-size: 15px;
            color: var(--color-red-main);
          }
        }
      }
    }
  }

  .back-top-btn {
    position: sticky;
    bottom: 12px;
    left: 100%;
    display: block;
    width: fit-content;
    margin-top: 10px;
    border: none;
    border-radius: 999px;
    background: var(--color-red-main);
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    transition: opacity 0.15s;

    &:hover {
      opacity: 0.85;
    }
  }
}
</style>
