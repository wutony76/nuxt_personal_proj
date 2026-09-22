<script setup lang="ts">
/**
 * NPC 自動遊玩設定：總開關、排程參數、NPC 會員清單（含每日花費上限/自動儲值編輯）、
 * 每個 NPC 各自勾選的遊戲清單（第一階段僅 BG 彩票／經典遊戲，台彩鏡射玩法／柑仔店櫥仔
 * 標記即將支援），並提供分類快捷全選/清空。見 openspec/changes/add-npc-auto-play。
 */
import { computed, onMounted, reactive, watch } from 'vue'
import {
  api,
  type AdminMemberBalanceChange,
  type AdminMemberLoginRecord,
  type NpcGameCategory,
  type NpcGameItem,
  type NpcGamePreset,
  type NpcMemberRow,
  type NpcSchedule,
  type NpcTimeSlot
} from '~/services/api'
import { balanceChangeTypeLabel } from '~/utils/balanceChangeLabel'
import { formatUserAgentShort } from '~/utils/userAgentLabel'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'
type LedgerTab = 'balance' | 'login'

const DEFAULT_NPC_PASSWORD = '222222'
const NPC_EMAIL_DOMAIN = '@npc.hfyy.cc'

const state = reactive({
  status: 'idle' as AsyncStatus,
  error: '',
  enabled: false,
  togglePending: false,
  schedule: {
    tickIntervalSec: 30,
    retroScoreMinPct: 10,
    retroScoreMaxPct: 40,
    bgWeight: 50,
    retroWeight: 50,
    bgBetAmountMin: 10,
    bgBetAmountMax: 150
  } as NpcSchedule,
  scheduleDraft: {} as Record<string, string>,
  scheduleSaving: false,
  scheduleError: '',
  members: [] as NpcMemberRow[],
  selectedId: null as string | null,
  detailTab: 'info' as 'info' | 'settings' | 'games',
  memberDraft: {
    dailyMaxSpend: '',
    topUpAmount: '',
    retroScoreMinPct: '',
    retroScoreMaxPct: '',
    bgWeight: '',
    retroWeight: '',
    bgBetAmountMin: '',
    bgBetAmountMax: '',
    actionIntervalSec: '',
    actionJitterChancePct: '',
    actionJitterMaxSec: ''
  },
  memberTimeSlotsDraft: [] as string[],
  memberError: '',
  timeSlots: [] as NpcTimeSlot[],
  ledgerTab: 'balance' as LedgerTab,
  balanceStatus: 'idle' as AsyncStatus,
  balanceError: '',
  balanceRows: [] as AdminMemberBalanceChange[],
  loginStatus: 'idle' as AsyncStatus,
  loginError: '',
  loginRows: [] as AdminMemberLoginRecord[],
  createForm: { name: '', email: '', password: DEFAULT_NPC_PASSWORD },
  createEmailTouched: false,
  createStatus: 'idle' as AsyncStatus,
  createError: '',
  createSuccessId: '',
  autoCreateStatus: 'idle' as AsyncStatus,
  autoCreateError: '',
  autoCreateSuccessName: '',
  nameWords: [] as string[],
  nameWordsOpen: false,
  nameWordDraft: '',
  nameWordsSaving: false,
  nameWordsError: '',
  games: [] as NpcGameItem[],
  gameTogglePending: {} as Record<string, boolean>,
  gameBulkPending: {} as Record<string, boolean>,
  gamePresets: [] as NpcGamePreset[],
  presetNameDraft: '',
  presetSaving: false,
  presetError: '',
  presetApplyingId: null as string | null,
  presetDeletingId: null as string | null
})

const SCHEDULE_FIELDS: Array<{ key: keyof NpcSchedule; label: string; suffix: string }> = [
  { key: 'tickIntervalSec', label: '排程檢查間隔', suffix: '秒' },
  { key: 'retroScoreMinPct', label: '經典遊戲模擬分數下限（全域預設）', suffix: '% of max' },
  { key: 'retroScoreMaxPct', label: '經典遊戲模擬分數上限（全域預設）', suffix: '% of max' },
  { key: 'bgWeight', label: 'BG 彩票權重（全域預設）', suffix: '' },
  { key: 'retroWeight', label: '經典遊戲權重（全域預設）', suffix: '' },
  { key: 'bgBetAmountMin', label: 'BG 單注金額下限（全域預設）', suffix: 'coin' },
  { key: 'bgBetAmountMax', label: 'BG 單注金額上限（全域預設）', suffix: 'coin' }
]

/**
 * 這幾個欄位每個 NPC 會員可以各自覆蓋（見 NpcMemberRow）：NPC 沒存過設定時顯示/套用
 * 上面「排程參數」的全域預設值，一旦存過（按下「儲存」）就固定用自己的值。
 */
const MEMBER_NUMBER_FIELDS: Array<{
  key: 'dailyMaxSpend' | 'topUpAmount' | 'retroScoreMinPct' | 'retroScoreMaxPct' | 'bgWeight' | 'retroWeight' | 'bgBetAmountMin' | 'bgBetAmountMax'
  | 'actionIntervalSec' | 'actionJitterChancePct' | 'actionJitterMaxSec'
  label: string
}> = [
    { key: 'dailyMaxSpend', label: '每日上限' },
    { key: 'topUpAmount', label: '自動儲值' },
    { key: 'retroScoreMinPct', label: '經典遊戲模擬分數下限（%）' },
    { key: 'retroScoreMaxPct', label: '經典遊戲模擬分數上限（%）' },
    { key: 'bgWeight', label: 'BG 彩票權重' },
    { key: 'retroWeight', label: '經典遊戲權重' },
    { key: 'bgBetAmountMin', label: 'BG 單注金額下限' },
    { key: 'bgBetAmountMax', label: 'BG 單注金額上限' },
    { key: 'actionIntervalSec', label: '遊戲頻率（秒）' },
    { key: 'actionJitterChancePct', label: '隨機延遲機率（%）' },
    { key: 'actionJitterMaxSec', label: '隨機延遲上限（秒）' }
  ]

const CATEGORY_LABEL: Record<NpcGameCategory, string> = {
  bg: 'BG 彩票',
  retro: '經典遊戲',
  tw: '台彩鏡射玩法',
  toys: '柑仔店櫥仔'
}

const _handlers = {
  formatMoney: (value: number) =>
    Number(value ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  formatTime: (ms: number) => {
    const t = Number(ms)
    if (!t) return '—'
    return new Date(t).toLocaleString('zh-TW')
  },
  formatDevice: (userAgent: string) => formatUserAgentShort(userAgent) || '—'
}

const gamesByCategory = computed(() => {
  const groups: Record<NpcGameCategory, NpcGameItem[]> = { bg: [], retro: [], tw: [], toys: [] }
  for (const g of state.games) groups[g.category].push(g)
  return groups
})

function timeSlotLabelsOf(row: NpcMemberRow): string {
  if (row.activeTimeSlots.length === state.timeSlots.length) return '不限時段（全選）'
  if (row.activeTimeSlots.length === 0) return '未勾選任何時段（暫停行動）'
  return state.timeSlots
    .filter((slot) => row.activeTimeSlots.includes(slot.id))
    .map((slot) => slot.label)
    .join('、')
}

const selectedMember = computed(() =>
  state.members.find((m) => m.id === state.selectedId) ?? null)

function _draftOf(row: NpcMemberRow) {
  return {
    dailyMaxSpend: String(row.dailyMaxSpend),
    topUpAmount: String(row.topUpAmount),
    retroScoreMinPct: String(row.retroScoreMinPct),
    retroScoreMaxPct: String(row.retroScoreMaxPct),
    bgWeight: String(row.bgWeight),
    retroWeight: String(row.retroWeight),
    bgBetAmountMin: String(row.bgBetAmountMin),
    bgBetAmountMax: String(row.bgBetAmountMax),
    actionIntervalSec: String(row.actionIntervalSec),
    actionJitterChancePct: String(row.actionJitterChancePct),
    actionJitterMaxSec: String(row.actionJitterMaxSec)
  }
}

const _actions = {
  fetch: async () => {
    state.status = 'loading'
    state.error = ''
    try {
      const res = await api.admin.npc.settings()
      state.enabled = res.enabled
      state.schedule = res.schedule
      state.members = res.members
      state.games = res.games
      state.timeSlots = res.timeSlots
      state.gamePresets = res.gamePresets
      state.nameWords = res.nameWords
      if (!state.selectedId || !state.members.some((m) => m.id === state.selectedId)) {
        state.selectedId = state.members[0]?.id ?? null
      }
      const current = state.members.find((m) => m.id === state.selectedId)
      if (current) {
        state.memberDraft = _draftOf(current)
        state.memberTimeSlotsDraft = [...current.activeTimeSlots]
      }
      state.status = 'success'
    } catch (e: unknown) {
      state.error = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message ?? '載入失敗'
      state.status = 'error'
    }
  },
  toggleEnabled: async () => {
    if (state.togglePending) return
    state.togglePending = true
    try {
      const res = await api.admin.npc.updateSettings({ enabled: !state.enabled })
      state.enabled = res.enabled
    } catch (e: unknown) {
      state.error = (e as { data?: { message?: string } })?.data?.message ?? '切換失敗，請稍後再試。'
    } finally {
      state.togglePending = false
    }
  },
  saveSchedule: async () => {
    if (state.scheduleSaving) return
    const patch: Partial<Record<keyof NpcSchedule, number>> = {}
    for (const field of SCHEDULE_FIELDS) {
      const raw = state.scheduleDraft[field.key]
      if (raw === undefined) continue
      const num = Number(raw)
      if (!Number.isFinite(num) || num < 0) {
        state.scheduleError = `${field.label} 必須是不小於 0 的數字。`
        return
      }
      patch[field.key] = num
    }
    state.scheduleSaving = true
    state.scheduleError = ''
    try {
      const res = await api.admin.npc.updateSettings({ schedule: patch })
      state.schedule = res.schedule
      state.scheduleDraft = {}
    } catch (e: unknown) {
      state.scheduleError = (e as { data?: { message?: string } })?.data?.message ?? '儲存失敗，請稍後再試。'
    } finally {
      state.scheduleSaving = false
    }
  },
  toggleMemberGame: async (userId: string, row: NpcGameItem, allowed: boolean) => {
    if (!row.supported) return
    const compositeKey = `${row.category}:${row.key}`
    if (state.gameTogglePending[compositeKey]) return
    state.gameTogglePending[compositeKey] = true
    try {
      const res = await api.admin.npc.setMemberGameAllowed(userId, row.category, row.key, allowed)
      state.members = state.members.map((m) =>
        m.id === userId ? { ...m, allowedGames: res.allowedGames } : m)
    } catch (e: unknown) {
      state.error = (e as { data?: { message?: string } })?.data?.message ?? '切換失敗，請稍後再試。'
    } finally {
      state.gameTogglePending[compositeKey] = false
    }
  },
  bulkSetMemberGames: async (userId: string, category: NpcGameCategory, allowed: boolean) => {
    const pendingKey = `${userId}:${category}`
    if (state.gameBulkPending[pendingKey]) return
    state.gameBulkPending[pendingKey] = true
    try {
      const res = await api.admin.npc.setMemberGamesBulk(userId, category, allowed)
      state.members = state.members.map((m) =>
        m.id === userId ? { ...m, allowedGames: res.allowedGames } : m)
    } catch (e: unknown) {
      state.error = (e as { data?: { message?: string } })?.data?.message ?? '快捷選擇失敗，請稍後再試。'
    } finally {
      state.gameBulkPending[pendingKey] = false
    }
  },
  saveGamePreset: async () => {
    const row = selectedMember.value
    if (!row || state.presetSaving) return
    const name = state.presetNameDraft.trim()
    if (!name) {
      state.presetError = '請輸入保存的名稱。'
      return
    }
    state.presetSaving = true
    state.presetError = ''
    try {
      const preset = await api.admin.npc.saveGamePreset(name, row.allowedGames)
      state.gamePresets = [preset, ...state.gamePresets]
      state.presetNameDraft = ''
    } catch (e: unknown) {
      state.presetError = (e as { data?: { message?: string } })?.data?.message ?? '保存失敗，請稍後再試。'
    } finally {
      state.presetSaving = false
    }
  },
  applyGamePreset: async (presetId: string) => {
    const row = selectedMember.value
    if (!row || state.presetApplyingId) return
    state.presetApplyingId = presetId
    state.presetError = ''
    try {
      const res = await api.admin.npc.applyGamePreset(row.id, presetId)
      state.members = state.members.map((m) =>
        m.id === row.id ? { ...m, allowedGames: res.allowedGames } : m)
    } catch (e: unknown) {
      state.presetError = (e as { data?: { message?: string } })?.data?.message ?? '套用失敗，請稍後再試。'
    } finally {
      state.presetApplyingId = null
    }
  },
  deleteGamePreset: async (presetId: string) => {
    if (state.presetDeletingId) return
    state.presetDeletingId = presetId
    state.presetError = ''
    try {
      await api.admin.npc.deleteGamePreset(presetId)
      state.gamePresets = state.gamePresets.filter((p) => p.id !== presetId)
    } catch (e: unknown) {
      state.presetError = (e as { data?: { message?: string } })?.data?.message ?? '刪除失敗，請稍後再試。'
    } finally {
      state.presetDeletingId = null
    }
  },
  createMember: async () => {
    if (state.createStatus === 'loading') return
    const name = state.createForm.name.trim()
    const email = state.createForm.email.trim()
    const password = state.createForm.password
    if (!name) {
      state.createError = '請輸入帳號。'
      return
    }
    if (!email) {
      state.createError = '請輸入 Email。'
      return
    }
    if (password.length < 6) {
      state.createError = '密碼至少 6 字元。'
      return
    }
    state.createStatus = 'loading'
    state.createError = ''
    state.createSuccessId = ''
    try {
      const res = await api.admin.createMember({ name, email, password, role: 'npc' })
      state.createForm = { name: '', email: '', password: DEFAULT_NPC_PASSWORD }
      state.createEmailTouched = false
      state.createSuccessId = res.user.id
      state.createStatus = 'success'
      state.selectedId = res.user.id
      await _actions.fetch()
    } catch (e: unknown) {
      state.createError = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message ?? '新增失敗'
      state.createStatus = 'error'
    }
  },
  autoCreateMember: async () => {
    if (state.autoCreateStatus === 'loading') return
    state.autoCreateStatus = 'loading'
    state.autoCreateError = ''
    state.autoCreateSuccessName = ''
    try {
      const res = await api.admin.npc.autoCreateMember()
      state.autoCreateSuccessName = res.user.name
      state.autoCreateStatus = 'success'
      state.selectedId = res.user.id
      await _actions.fetch()
    } catch (e: unknown) {
      state.autoCreateError = (e as { data?: { message?: string }; message?: string })?.data?.message
        ?? (e as { message?: string })?.message ?? '自動新增失敗'
      state.autoCreateStatus = 'error'
    }
  },
  addNameWord: async () => {
    const word = state.nameWordDraft.trim()
    if (!word) return
    if (state.nameWords.includes(word)) {
      state.nameWordsError = '這個單字已經在單字庫裡了。'
      return
    }
    await _actions.saveNameWords([word, ...state.nameWords])
    if (!state.nameWordsError) state.nameWordDraft = ''
  },
  removeNameWord: async (word: string) => {
    await _actions.saveNameWords(state.nameWords.filter((w) => w !== word))
  },
  saveNameWords: async (words: string[]) => {
    if (state.nameWordsSaving) return
    if (words.length < 2) {
      state.nameWordsError = '單字庫至少需要 2 個單字才能組合出名稱。'
      return
    }
    state.nameWordsSaving = true
    state.nameWordsError = ''
    try {
      const res = await api.admin.npc.setNameWords(words)
      state.nameWords = res.nameWords
    } catch (e: unknown) {
      state.nameWordsError = (e as { data?: { message?: string } })?.data?.message ?? '儲存失敗，請稍後再試。'
    } finally {
      state.nameWordsSaving = false
    }
  },
  saveMember: async () => {
    const row = selectedMember.value
    if (!row) return
    const patch: Record<string, number> = {}
    for (const field of MEMBER_NUMBER_FIELDS) {
      const num = Number(state.memberDraft[field.key])
      if (!Number.isFinite(num) || num < 0) {
        state.memberError = `${field.label} 必須是不小於 0 的數字。`
        return
      }
      patch[field.key] = num
    }
    if (patch.bgBetAmountMin! > patch.bgBetAmountMax!) {
      state.memberError = 'BG 單注金額下限不可高於上限。'
      return
    }
    if (patch.retroScoreMinPct! > patch.retroScoreMaxPct!) {
      state.memberError = '經典遊戲模擬分數下限不可高於上限。'
      return
    }
    if (patch.actionJitterChancePct! > 100) {
      state.memberError = '隨機延遲機率必須是 0～100 之間的數字。'
      return
    }
    try {
      const updated = await api.admin.npc.setMemberSetting(row.id, {
        ...patch,
        activeTimeSlots: state.memberTimeSlotsDraft
      })
      state.members = state.members.map((m) => (m.id === row.id ? { ...m, ...updated } : m))
      state.memberDraft = _draftOf({ ...row, ...updated })
      state.memberTimeSlotsDraft = [...updated.activeTimeSlots]
      state.memberError = ''
    } catch (e: unknown) {
      state.memberError = (e as { data?: { message?: string } })?.data?.message ?? '儲存失敗，請稍後再試。'
    }
  },
  fetchBalanceHistory: async (userId?: string) => {
    const id = userId ?? state.selectedId
    if (!id) {
      state.balanceRows = []
      state.balanceStatus = 'idle'
      state.balanceError = ''
      return
    }
    state.balanceStatus = 'loading'
    state.balanceError = ''
    try {
      const res = await api.admin.memberBalanceChanges(id)
      state.balanceRows = res.changes
      state.balanceStatus = 'success'
    } catch (e: unknown) {
      state.balanceError = (e as { message?: string })?.message ?? '載入變動紀錄失敗'
      state.balanceStatus = 'error'
    }
  },
  fetchLoginHistory: async (userId?: string) => {
    const id = userId ?? state.selectedId
    if (!id) {
      state.loginRows = []
      state.loginStatus = 'idle'
      state.loginError = ''
      return
    }
    state.loginStatus = 'loading'
    state.loginError = ''
    try {
      const res = await api.admin.memberLoginHistory(id)
      state.loginRows = res.logins
      state.loginStatus = 'success'
    } catch (e: unknown) {
      state.loginError = (e as { message?: string })?.message ?? '載入登入紀錄失敗'
      state.loginStatus = 'error'
    }
  }
}

const click = {
  toggleEnabled: () => _actions.toggleEnabled(),
  saveSchedule: () => _actions.saveSchedule(),
  toggleMemberGame: (userId: string, row: NpcGameItem, allowed: boolean) =>
    _actions.toggleMemberGame(userId, row, allowed),
  bulkSetMemberGames: (userId: string, category: NpcGameCategory, allowed: boolean) =>
    _actions.bulkSetMemberGames(userId, category, allowed),
  saveGamePreset: () => _actions.saveGamePreset(),
  applyGamePreset: (presetId: string) => _actions.applyGamePreset(presetId),
  deleteGamePreset: (presetId: string) => _actions.deleteGamePreset(presetId),
  selectMember: (row: NpcMemberRow) => {
    state.selectedId = row.id
    state.detailTab = 'info'
    state.memberDraft = _draftOf(row)
    state.memberTimeSlotsDraft = [...row.activeTimeSlots]
    state.memberError = ''
    state.presetError = ''
    state.presetNameDraft = ''
  },
  setDetailTab: (tab: 'info' | 'settings' | 'games') => {
    state.detailTab = tab
  },
  toggleTimeSlotDraft: (id: string) => {
    state.memberTimeSlotsDraft = state.memberTimeSlotsDraft.includes(id)
      ? state.memberTimeSlotsDraft.filter((s) => s !== id)
      : [...state.memberTimeSlotsDraft, id]
  },
  saveMember: () => _actions.saveMember(),
  createMember: () => _actions.createMember(),
  inputCreateName: (event: Event) => {
    const name = (event.target as HTMLInputElement).value
    state.createForm.name = name
    if (!state.createEmailTouched) {
      const local = name.trim().replace(/\s+/g, '_')
      state.createForm.email = local ? `${local}${NPC_EMAIL_DOMAIN}` : ''
    }
  },
  inputCreateEmail: (event: Event) => {
    state.createForm.email = (event.target as HTMLInputElement).value
    state.createEmailTouched = true
  },
  setLedgerTab: (tab: LedgerTab) => {
    state.ledgerTab = tab
  },
  autoCreateMember: () => _actions.autoCreateMember(),
  toggleNameWordsOpen: () => {
    state.nameWordsOpen = !state.nameWordsOpen
    state.nameWordsError = ''
  },
  addNameWord: () => _actions.addNameWord(),
  removeNameWord: (word: string) => _actions.removeNameWord(word)
}

onMounted(() => _actions.fetch())

watch(
  () => [state.selectedId, state.detailTab, state.ledgerTab] as const,
  ([id, tab, ledgerTab]) => {
    if (tab !== 'info' || !id) return
    if (ledgerTab === 'balance') _actions.fetchBalanceHistory(id)
    else _actions.fetchLoginHistory(id)
  }
)
</script>

<template>
  <div class="np">
    <div v-if="state.status === 'loading'" class="admin-empty">載入中...</div>
    <div v-else-if="state.status === 'error'" class="admin-empty">{{ state.error }}</div>
    <template v-else>
      <!-- 總覽 -->
      <div id="np-overview" class="np-toggle-row">
        <span class="np-toggle-status" :class="{ on: state.enabled }">
          {{ state.enabled ? '啟用中' : '已關閉' }}
        </span>
        <button type="button" class="admin-btn admin-btn-primary" :disabled="state.togglePending"
          @click="click.toggleEnabled()">
          {{ state.togglePending ? '處理中…' : (state.enabled ? '關閉 NPC 自動遊玩' : '開啟 NPC 自動遊玩') }}
        </button>
      </div>

      <!-- 全域設定 -->
      <div id="np-global-settings" class="np-section">
        <div class="admin-sechead">
          <div class="admin-sechead-left"><span class="admin-en">Schedule</span>
            <h2>全域設定</h2>
          </div>
        </div>
        <div class="np-schedule-list">
          <div v-for="field in SCHEDULE_FIELDS" :key="field.key" class="np-schedule-row">
            <label class="np-schedule-label">{{ field.label }}</label>
            <div class="np-schedule-input-row">
              <input class="admin-input admin-num np-schedule-input"
                :value="state.scheduleDraft[field.key] ?? state.schedule[field.key]"
                @input="state.scheduleDraft[field.key] = ($event.target as HTMLInputElement).value">
              <span class="np-schedule-suffix">{{ field.suffix }}</span>
            </div>
          </div>
        </div>
        <div class="np-schedule-actions">
          <button type="button" class="admin-btn admin-btn-primary" :disabled="state.scheduleSaving"
            @click="click.saveSchedule()">
            {{ state.scheduleSaving ? '儲存中…' : '儲存' }}
          </button>
        </div>
        <p v-if="state.scheduleError" class="np-error">{{ state.scheduleError }}</p>
      </div>

      <!-- NPC 會員清單 -->
      <div id="np-members" class="np-section">
        <div class="admin-sechead">
          <div class="admin-sechead-left"><span class="admin-en">Members</span>
            <h2>NPC 會員</h2>
          </div>
          <span class="admin-meta">共 {{ state.members.length }} 位</span>
        </div>

        <form class="np-create-form" @submit.prevent="click.createMember()">
          <div class="admin-field np-create-field">
            <label>帳號</label>
            <input :value="state.createForm.name" type="text" class="admin-input" maxlength="40" placeholder="請輸入帳號"
              autocomplete="off" @input="click.inputCreateName">
          </div>
          <div class="admin-field np-create-field">
            <label>Email</label>
            <input :value="state.createForm.email" type="email" class="admin-input" placeholder="自動帶入 帳號@npc.hfyy.cc"
              autocomplete="off" @input="click.inputCreateEmail">
          </div>
          <div class="admin-field np-create-field">
            <label>密碼</label>
            <input v-model="state.createForm.password" type="text" class="admin-input" minlength="6" maxlength="72"
              placeholder="至少 6 字元" autocomplete="off">
          </div>
          <div class="admin-field np-create-field np-create-field-role">
            <label>角色</label>
            <span class="admin-tag">NPC</span>
          </div>
          <div class="np-create-actions">
            <button type="submit" class="admin-btn admin-btn-primary" :disabled="state.createStatus === 'loading'">
              {{ state.createStatus === 'loading' ? '新增中…' : '新增 NPC 會員' }}
            </button>
          </div>
        </form>
        <p v-if="state.createError" class="np-error">{{ state.createError }}</p>
        <p v-else-if="state.createStatus === 'success'" class="np-ok">
          已建立 <span class="admin-num">{{ state.createSuccessId }}</span>（in-memory，重啟後消失）
        </p>

        <div class="np-autocreate-row">
          <button type="button" class="admin-btn admin-btn-secondary" :disabled="state.autoCreateStatus === 'loading'"
            @click="click.autoCreateMember()">
            {{ state.autoCreateStatus === 'loading' ? '新增中…' : '直接新增.NPC' }}
          </button>
          <button type="button" class="np-game-quick-btn" @click="click.toggleNameWordsOpen()">
            {{ state.nameWordsOpen ? '收合單字庫設定' : '單字庫設定' }}
          </button>
          <span v-if="state.autoCreateStatus === 'success'" class="np-ok">
            已自動建立 <span class="admin-num">{{ state.autoCreateSuccessName }}</span>
          </span>
          <span v-else-if="state.autoCreateError" class="np-error">{{ state.autoCreateError }}</span>
        </div>
        <p class="np-hint np-hint-right">點擊「自動新增」會從下面的單字庫隨機挑 2 個單字組成名稱建立一個 NPC 會員；如果組出來的名稱已經存在，後面會直接加上數字避免重複。</p>

        <div v-if="state.nameWordsOpen" class="np-preset-panel">
          <form class="np-preset-save-form" @submit.prevent="click.addNameWord()">
            <input v-model="state.nameWordDraft" type="text" class="admin-input np-preset-name-input" maxlength="20"
              placeholder="輸入單字加入單字庫" autocomplete="off">
            <button type="submit" class="admin-btn admin-btn-secondary" :disabled="state.nameWordsSaving">
              {{ state.nameWordsSaving ? '儲存中…' : '新增單字' }}
            </button>
          </form>
          <p v-if="state.nameWordsError" class="np-error">{{ state.nameWordsError }}</p>
          <div class="np-nameword-list">
            <span v-for="word in state.nameWords" :key="word" class="np-nameword-tag">
              {{ word }}
              <button type="button" class="np-nameword-remove" :disabled="state.nameWordsSaving"
                @click="click.removeNameWord(word)">×</button>
            </span>
          </div>
        </div>

        <div v-if="!state.members.length" class="admin-empty">目前沒有角色為 NPC 的會員</div>
        <div v-else class="np-grid">
          <div class="np-list-wrap">
            <div class="np-col-label admin-en">Members</div>
            <ul class="np-list">
              <li v-for="row in state.members" :key="row.id" class="np-list-item"
                :class="{ 'is-active': row.id === state.selectedId }">
                <button type="button" class="np-list-item-btn" @click="click.selectMember(row)">
                  <span class="np-list-item-name">{{ row.name }}</span>
                  <span class="np-list-item-meta">
                    <span class="admin-num np-list-item-id">{{ row.id }}</span>
                    <span class="admin-tag">{{ row.allowedGames.length }} 款</span>
                  </span>
                </button>
              </li>
            </ul>
          </div>

          <div v-if="selectedMember" class="np-detail">
            <div class="np-detail-card">
              <div class="np-detail-name">{{ selectedMember.name }}</div>
              <div class="np-detail-grid">
                <span class="np-detail-k">User ID</span>
                <span class="admin-num">{{ selectedMember.id }}</span>
                <span class="np-detail-k">Email</span>
                <span>{{ selectedMember.email }}</span>
                <span class="np-detail-k">F幣餘額</span>
                <span class="admin-num">{{ selectedMember.coin.toLocaleString('zh-TW') }}</span>
                <span class="np-detail-k">今日已花費</span>
                <span class="admin-num">{{ selectedMember.spentToday.toLocaleString('zh-TW') }}</span>
                <span class="np-detail-k">每日上限</span>
                <span class="admin-num">{{ selectedMember.dailyMaxSpend.toLocaleString('zh-TW') }}</span>
                <span class="np-detail-k">自動儲值</span>
                <span class="admin-num">{{ selectedMember.topUpAmount.toLocaleString('zh-TW') }}</span>
              </div>
            </div>

            <nav class="np-tabs" aria-label="NPC 會員功能分頁">
              <button type="button" class="np-tab" :class="{ 'is-active': state.detailTab === 'info' }"
                @click="click.setDetailTab('info')">
                <span class="np-tab-label">資訊</span>
                <span class="admin-en np-tab-en">Info</span>
              </button>
              <button type="button" class="np-tab" :class="{ 'is-active': state.detailTab === 'settings' }"
                @click="click.setDetailTab('settings')">
                <span class="np-tab-label">設定</span>
                <span class="admin-en np-tab-en">Settings</span>
              </button>
              <button type="button" class="np-tab" :class="{ 'is-active': state.detailTab === 'games' }"
                @click="click.setDetailTab('games')">
                <span class="np-tab-label">遊戲</span>
                <span class="admin-en np-tab-en">Games</span>
              </button>
            </nav>

            <section v-if="state.detailTab === 'info'" class="np-detail-info">
              <div class="admin-sechead">
                <div class="admin-sechead-left"><span class="admin-en">Overview</span>
                  <h2>總覽</h2>
                </div>
              </div>
              <div class="np-overview-list">
                <span class="np-detail-k">BG 彩票權重</span>
                <span class="admin-num">{{ selectedMember.bgWeight.toLocaleString('zh-TW') }}</span>
                <span class="np-detail-k">經典遊戲權重</span>
                <span class="admin-num">{{ selectedMember.retroWeight.toLocaleString('zh-TW') }}</span>
                <span class="np-detail-k">BG 單注金額下限</span>
                <span class="admin-num">{{ selectedMember.bgBetAmountMin.toLocaleString('zh-TW') }}</span>
                <span class="np-detail-k">BG 單注金額上限</span>
                <span class="admin-num">{{ selectedMember.bgBetAmountMax.toLocaleString('zh-TW') }}</span>
                <span class="np-detail-k">經典遊戲模擬分數下限</span>
                <span class="admin-num">{{ selectedMember.retroScoreMinPct.toLocaleString('zh-TW') }}%</span>
                <span class="np-detail-k">經典遊戲模擬分數上限</span>
                <span class="admin-num">{{ selectedMember.retroScoreMaxPct.toLocaleString('zh-TW') }}%</span>
                <span class="np-detail-k">遊戲時段</span>
                <span>{{ timeSlotLabelsOf(selectedMember) }}</span>
                <span class="np-detail-k">遊戲頻率</span>
                <span class="admin-num">{{ selectedMember.actionIntervalSec.toLocaleString('zh-TW') }} 秒</span>
                <span class="np-detail-k">隨機延遲機率</span>
                <span class="admin-num">{{ selectedMember.actionJitterChancePct.toLocaleString('zh-TW') }}%</span>
                <span class="np-detail-k">隨機延遲上限</span>
                <span class="admin-num">{{ selectedMember.actionJitterMaxSec.toLocaleString('zh-TW') }} 秒</span>
              </div>

              <div class="admin-sechead np-ledger-sechead">
                <div class="admin-sechead-left"><span class="admin-en">Records</span>
                  <h2>紀錄</h2>
                </div>
              </div>
              <nav class="np-ledger-tabs" aria-label="紀錄分類">
                <button type="button" class="np-ledger-tab" :class="{ 'is-active': state.ledgerTab === 'balance' }"
                  @click="click.setLedgerTab('balance')">
                  <span class="np-ledger-tab-label">F幣 變動紀錄</span>
                  <span class="admin-en np-ledger-tab-en">Balance</span>
                </button>
                <button type="button" class="np-ledger-tab" :class="{ 'is-active': state.ledgerTab === 'login' }"
                  @click="click.setLedgerTab('login')">
                  <span class="np-ledger-tab-label">登入紀錄</span>
                  <span class="admin-en np-ledger-tab-en">Login</span>
                </button>
              </nav>

              <template v-if="state.ledgerTab === 'balance'">
                <div v-if="state.balanceStatus === 'loading'" class="admin-empty np-ledger-empty">載入中…</div>
                <div v-else-if="state.balanceStatus === 'error'" class="np-error np-ledger-empty">{{ state.balanceError
                  }}</div>
                <div v-else-if="state.balanceRows.length === 0" class="admin-empty np-ledger-empty">尚無變動紀錄</div>
                <div v-else class="np-ledger-table-wrap">
                  <table class="np-ledger-table">
                    <thead>
                      <tr>
                        <th>時間</th>
                        <th>來源</th>
                        <th>類型</th>
                        <th>期數</th>
                        <th>備註</th>
                        <th class="is-num">變動</th>
                        <th class="is-num">餘額</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in state.balanceRows" :key="row.id">
                        <td class="np-ledger-time">{{ _handlers.formatTime(row.createdAt) }}</td>
                        <td>{{ row.sourceLabel }}</td>
                        <td>{{ balanceChangeTypeLabel(row.type) }}</td>
                        <td>{{ row.issue || '—' }}</td>
                        <td class="np-ledger-note">{{ row.note || '—' }}</td>
                        <td class="is-num" :class="row.amount < 0 ? 'np-ledger-minus' : 'np-ledger-plus'">
                          {{ _handlers.formatMoney(row.amount) }}
                        </td>
                        <td class="is-num">{{ _handlers.formatMoney(row.after) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>

              <template v-else>
                <div v-if="state.loginStatus === 'loading'" class="admin-empty np-ledger-empty">載入中…</div>
                <div v-else-if="state.loginStatus === 'error'" class="np-error np-ledger-empty">{{ state.loginError }}
                </div>
                <div v-else-if="state.loginRows.length === 0" class="admin-empty np-ledger-empty">尚無登入紀錄</div>
                <div v-else class="np-ledger-table-wrap">
                  <table class="np-ledger-table">
                    <thead>
                      <tr>
                        <th>時間</th>
                        <th>Email</th>
                        <th>IP</th>
                        <th>裝置</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in state.loginRows" :key="row.id">
                        <td class="np-ledger-time">{{ _handlers.formatTime(row.createdAt) }}</td>
                        <td>{{ row.email }}</td>
                        <td class="np-ledger-ip">{{ row.ip || '—' }}</td>
                        <td class="np-ledger-note np-ledger-device" :title="row.userAgent || undefined">
                          {{ _handlers.formatDevice(row.userAgent) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </section>

            <section v-else-if="state.detailTab === 'settings'" class="np-detail-settings">
              <div class="np-detail-edit-grid">
                <template v-for="field in MEMBER_NUMBER_FIELDS" :key="field.key">
                  <label class="np-detail-edit-label">{{ field.label }}</label>
                  <input v-model="state.memberDraft[field.key]" class="admin-input admin-num np-detail-edit-input">
                </template>
                <label class="np-detail-edit-label">遊戲時段</label>
                <div class="np-timeslot-list">
                  <label v-for="slot in state.timeSlots" :key="slot.id" class="np-timeslot-option">
                    <input type="checkbox" :checked="state.memberTimeSlotsDraft.includes(slot.id)"
                      @change="click.toggleTimeSlotDraft(slot.id)">
                    <span>{{ slot.label }}</span>
                  </label>
                </div>
              </div>
              <p class="np-hint">
                BG 彩票權重／經典遊戲權重決定這個 NPC 每次行動選哪一類玩法（比例關係，不需加總為 100）。
                經典遊戲模擬分數、權重、單注金額這幾個欄位，在這個 NPC 沒存過設定前會顯示
                「排程參數」的全域預設值；按下「儲存」後就固定用這裡填的值，不再跟著全域預設變動。
                每日上限／自動儲值／遊戲頻率／隨機延遲機率／隨機延遲上限這幾個欄位沒有全域預設，
                固定套用系統內建預設值。
              </p>
              <p class="np-hint">
                遊戲頻率：這個 NPC 兩次行動間至少間隔幾秒；間隔到了之後，有機率（隨機延遲機率）
                再額外隨機延遲 0～隨機延遲上限秒，避免每次都固定間隔、行為太規律像機器人。
              </p>
              <p class="np-hint">遊戲時段：複選這個 NPC 允許自動遊玩的時段，只有落在勾選時段內才會行動；未勾選任何時段代表這個 NPC 暫停行動。</p>

              <div class="np-detail-edit-actions">
                <button type="button" class="admin-btn admin-btn-primary" @click="click.saveMember()">儲存</button>
              </div>
              <p v-if="state.memberError" class="np-error">{{ state.memberError }}</p>
            </section>

            <section v-else-if="state.detailTab === 'games'" class="np-detail-games">
              <p class="np-hint">
                勾選 <strong>{{ selectedMember.name }}</strong> 可以自動遊玩的遊戲。每個 NPC 各自獨立設定，
                設定後即時保存。台彩鏡射玩法、柑仔店櫥仔尚未支援 NPC 自動遊玩，先列出清單。
              </p>

              <div class="np-preset-panel">
                <form class="np-preset-save-form" @submit.prevent="click.saveGamePreset()">
                  <input v-model="state.presetNameDraft" type="text" class="admin-input np-preset-name-input"
                    maxlength="30" placeholder="輸入名稱保存目前的勾選" autocomplete="off">
                  <button type="submit" class="admin-btn admin-btn-secondary" :disabled="state.presetSaving">
                    {{ state.presetSaving ? '保存中…' : '保存目前勾選' }}
                  </button>
                </form>
                <p v-if="state.presetError" class="np-error">{{ state.presetError }}</p>

                <div v-if="state.gamePresets.length" class="np-preset-list">
                  <div v-for="preset in state.gamePresets" :key="preset.id" class="np-preset-item">
                    <span class="np-preset-name">{{ preset.name }}</span>
                    <span class="np-preset-count">{{ preset.allowedGames.length }} 款</span>
                    <button type="button" class="np-game-quick-btn" :disabled="state.presetApplyingId === preset.id"
                      @click="click.applyGamePreset(preset.id)">
                      {{ state.presetApplyingId === preset.id ? '套用中…' : '快選套用' }}
                    </button>
                    <button type="button" class="np-game-quick-btn" :disabled="state.presetDeletingId === preset.id"
                      @click="click.deleteGamePreset(preset.id)">刪除</button>
                  </div>
                </div>
                <p v-else class="np-hint">還沒有保存過的遊戲勾選範本。</p>
              </div>

              <div v-for="cat in (['bg', 'retro', 'tw', 'toys'] as const)" :key="cat" class="np-game-section">
                <div class="np-game-section-head">
                  <span class="np-game-section-title">{{ CATEGORY_LABEL[cat] }}</span>
                  <span v-if="!['bg', 'retro'].includes(cat)" class="np-game-badge">即將支援</span>
                  <div v-else class="np-game-quick-actions">
                    <button type="button" class="np-game-quick-btn"
                      :disabled="!!state.gameBulkPending[`${selectedMember.id}:${cat}`]"
                      @click="click.bulkSetMemberGames(selectedMember.id, cat, true)">全選</button>
                    <button type="button" class="np-game-quick-btn"
                      :disabled="!!state.gameBulkPending[`${selectedMember.id}:${cat}`]"
                      @click="click.bulkSetMemberGames(selectedMember.id, cat, false)">清空</button>
                  </div>
                </div>
                <div class="np-game-grid">
                  <button v-for="g in gamesByCategory[cat]" :key="g.key" type="button" class="np-game-toggle"
                    :class="[selectedMember.allowedGames.includes(`${g.category}:${g.key}`) ? 'is-on' : 'is-off', { 'is-disabled': !g.supported }]"
                    :disabled="!g.supported || !!state.gameTogglePending[`${g.category}:${g.key}`]"
                    @click="click.toggleMemberGame(selectedMember.id, g, !selectedMember.allowedGames.includes(`${g.category}:${g.key}`))">
                    <span class="np-game-name">{{ g.name }}</span>
                    <span class="np-game-state">
                      {{ !g.supported ? '即將支援' : (selectedMember.allowedGames.includes(`${g.category}:${g.key}`) ? '已勾選'
                        : '未勾選') }}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.np {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.np-toggle-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.np-toggle-status {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);

  &.on {
    color: #16a34a;
  }
}

.np-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.np-schedule-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.np-schedule-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.np-schedule-label {
  width: 220px;
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--muted);
}

.np-schedule-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.np-schedule-input {
  width: 140px;
}

.np-schedule-suffix {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}

.np-schedule-actions {
  display: flex;
}

.np-create-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 14px;
  background: var(--wash);
  border: 1px solid var(--line);
  border-radius: 2px;
}

.np-create-field {
  flex: 1;
  min-width: 160px;
}

.np-create-field-role {
  flex: none;
  min-width: 0;
}

.np-create-actions {
  flex: none;
}

.np-ok {
  margin: 0;
  color: #15803d;
  font-size: 11px;
}

.np-grid {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(320px, 2.6fr);
  gap: 0 1px;
  background: var(--line);
  border: 1px solid var(--line);
  align-items: flex-start;
  min-height: 420px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    gap: 1px 0;
  }
}

.np-list-wrap {
  background: var(--wash);
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 640px;
  overflow: hidden;

  @media (max-width: 860px) {
    max-height: 220px;
  }
}

.np-col-label {
  padding: 10px 12px 0;
  color: var(--muted);
}

.np-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.np-list-item-btn {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  padding: 10px 12px;
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: inherit;
  font-family: inherit;

  &:hover {
    background: var(--paper);
  }
}

.np-list-item.is-active .np-list-item-btn {
  background: var(--paper);
  border-color: var(--ink);
}

.np-list-item-name {
  font-size: 13px;
  font-weight: 700;
}

.np-list-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.np-list-item-id {
  font-size: 11px;
  color: var(--muted);
}

.np-detail {
  background: var(--paper);
  padding: 18px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.np-detail-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.np-detail-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: 8px 12px;
  font-size: 12px;
}

.np-detail-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 6px;
  min-height: 0;
}

.np-overview-list {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: start;
  gap: 8px 12px;
  font-size: 12px;
}

.np-ledger-sechead {
  margin-top: 8px;
}

.np-ledger-tabs {
  display: flex;
  gap: 6px;
}

.np-ledger-tab {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  cursor: pointer;

  &:hover {
    color: var(--ink);
  }

  &.is-active {
    color: var(--ink);
    background: var(--wash);
    border-color: var(--ink);
  }
}

.np-ledger-tab-label {
  font-size: 12px;
  font-weight: 700;
}

.np-ledger-tab-en {
  font-size: 7px;
  letter-spacing: 0.14em;
  line-height: 1;
}

.np-ledger-table-wrap {
  max-height: 360px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--wash);
}

.np-ledger-empty {
  padding: 20px 0;
  text-align: center;
  font-size: 12px;
}

.np-ledger-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;

  th,
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--paper);
    font-weight: 700;
    white-space: nowrap;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  .is-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}

.np-ledger-time {
  white-space: nowrap;
}

.np-ledger-note {
  max-width: 120px;
  word-break: break-word;
}

.np-ledger-device {
  max-width: none;
  white-space: nowrap;
  cursor: help;
}

.np-ledger-ip {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.np-ledger-plus {
  color: #15803d;
  font-weight: 700;
}

.np-ledger-minus {
  color: #b91c1c;
  font-weight: 700;
}

.np-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--line);
}

.np-tab {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 72px;
  height: 42px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  cursor: pointer;
  text-align: left;

  &:hover {
    color: var(--ink);
  }

  &.is-active {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }
}

.np-tab-label {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.1;
}

.np-tab-en {
  font-size: 7px;
  letter-spacing: 0.16em;
  line-height: 1;
}

.np-detail-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 6px;
}

.np-detail-name {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}

.np-detail-k {
  white-space: nowrap;
  color: var(--muted);
}

.np-detail-edit-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: start;
  gap: 10px 12px;
}

.np-detail-edit-label {
  white-space: nowrap;
  color: var(--muted);
  padding-top: 6px;
}

.np-detail-edit-input {
  width: 140px;
  text-align: right;
}

.np-detail-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.np-timeslot-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.np-timeslot-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;

  input[type="checkbox"] {
    cursor: pointer;
  }
}

.np-detail-games {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 6px;
}

.np-hint {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}

.np-hint-right {
  text-align: right;
}

.np-game-section {
  margin-bottom: 20px;
}

.np-game-section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.np-game-quick-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.np-preset-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--wash);
  border: 1px solid var(--line);
  height: 230px;
  overflow-y: auto;
  border-radius: 2px;
}

.np-preset-save-form {
  display: flex;
  gap: 8px;
}

.np-preset-name-input {
  flex: 1;
  min-width: 0;
}

.np-preset-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.np-preset-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 2px;
}

.np-preset-name {
  font-size: 12px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}

.np-preset-count {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}

.np-autocreate-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.np-nameword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.np-nameword-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 10px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--paper);
  font-size: 11.5px;
}

.np-nameword-remove {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 13px;
  line-height: 1;
  padding: 2px 6px;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: #b91c1c;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.np-game-quick-btn {
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--paper);
  color: var(--ink);
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 8px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--wash);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.np-game-section-title {
  font-size: 12.5px;
  font-weight: 700;
}

.np-game-badge {
  font-size: 9.5px;
  letter-spacing: 0.08em;
  color: var(--muted);
  border: 1px solid var(--line);
  padding: 1px 6px;
}

.np-game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
}

.np-game-toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: var(--wash);
  font-family: inherit;
  cursor: pointer;
  text-align: left;

  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &.is-on {
    background: color-mix(in srgb, #16a34a 14%, var(--paper));
    border-color: #16a34a;

    .np-game-state {
      color: #15803d;
    }
  }

  &.is-off {
    background: var(--wash);
    border-color: var(--line);
  }
}

.np-game-name {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink);
}

.np-game-state {
  font-size: 10px;
  font-weight: 700;
  color: var(--muted);
}

.np-error {
  margin: 0;
  color: #b91c1c;
  font-size: 11px;
}
</style>
