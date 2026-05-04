import { computed, reactive } from 'vue'
import { LOTTERY } from '~/config/constants'
import { CREDIT_PLAY_DEFINITIONS } from '~/config/bg/6hc-cd'
import { api } from '~/services/api'

/**
 * @typedef {Object} CreditBetPayload
 * @property {string} playKey
 * @property {string} typeName
 * @property {string[]} codes
 * @property {number} amount
 */

export const use6hcCredit = () => {
  const state = reactive({
    selectedPlayKey: 'tema',
    selectedTypeName: '',
    activePlay: null,
    selectedCodes: [],
    amount: 10,
    customCodeInput: '',
    fetchStatus: 'idle',
    submitStatus: 'idle',
    message: '',
    errorMessage: '',
    lastOrderId: '',
    lastOrders: []
  })

  const playList = computed(() => CREDIT_PLAY_DEFINITIONS)

  const availableCodes = computed(() => {
    if (!state.activePlay || !state.selectedTypeName) {
      return []
    }
    return _handlers.getTypeOptions(state.activePlay, state.selectedTypeName)
  })

  const canSubmit = computed(() => {
    const amount = Number(state.amount)
    return state.submitStatus !== 'loading' && amount > 0 && state.selectedCodes.length > 0
  })

  const click = {
    handleSelectPlay: async (playKey) => {
      await _actions.fetchPlayByKey(playKey)
    },
    handleSelectType: async (typeName) => {
      await _actions.fetchTypeByName(typeName)
    },
    handleToggleCode: (option) => {
      _actions.toggleCode(option)
    },
    handleQuickAmount: (amount) => {
      _actions.setAmount(amount)
    },
    handleAppendCustomCode: () => {
      _actions.appendCustomCode()
    },
    handleResetSelection: () => {
      _actions.resetSelection()
    },
    handleSubmitBet: async () => {
      await _actions.submitBet()
    }
  }

  const _actions = {
    setAmount: (amount) => {
      const normalized = Number(amount)
      if (!Number.isFinite(normalized) || normalized <= 0) {
        return
      }
      state.amount = normalized
    },
    appendCustomCode: () => {
      const input = String(state.customCodeInput || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      if (input.length === 0) {
        return
      }
      const set = new Set(state.selectedCodes)
      input.forEach((code) => set.add(code))
      state.selectedCodes = Array.from(set)
      state.customCodeInput = ''
    },
    toggleCode: (option) => {
      const next = String(option?.label ?? option)
      if (state.submitStatus === 'loading') {
        return
      }
      if (state.selectedCodes.includes(next)) {
        state.selectedCodes = state.selectedCodes.filter((item) => item !== next)
        return
      }
      state.selectedCodes = [...state.selectedCodes, next]
    },
    resetSelection: () => {
      if (state.submitStatus === 'loading') {
        return
      }
      state.selectedCodes = []
      state.customCodeInput = ''
      state.message = ''
      state.errorMessage = ''
    },
    fetchTypeByName: async (typeName) => {
      if (state.fetchStatus === 'loading' || !state.activePlay) {
        return
      }
      if (!state.activePlay.playTypeNames.includes(typeName) || state.selectedTypeName === typeName) {
        return
      }
      state.fetchStatus = 'loading'
      state.errorMessage = ''
      try {
        state.selectedTypeName = typeName
        state.selectedCodes = []
        state.fetchStatus = 'success'
      } catch (error) {
        state.fetchStatus = 'error'
        state.errorMessage = error instanceof Error ? error.message : '子玩法切換失敗'
      }
    },
    fetchPlayByKey: async (playKey) => {
      if (state.fetchStatus === 'loading' || state.selectedPlayKey === playKey) {
        return
      }
      state.fetchStatus = 'loading'
      state.errorMessage = ''
      try {
        const nextPlay = _handlers.resolvePlayDefinition(playKey)
        if (!nextPlay) {
          throw new Error('找不到指定玩法')
        }
        state.selectedPlayKey = playKey
        state.activePlay = nextPlay
        state.selectedTypeName = nextPlay.playTypeNames[0] || ''
        state.selectedCodes = []
        state.fetchStatus = 'success'
      } catch (error) {
        state.fetchStatus = 'error'
        state.errorMessage = error instanceof Error ? error.message : '玩法載入失敗'
      }
    },
    initPlay: async () => {
      state.fetchStatus = 'loading'
      state.errorMessage = ''
      try {
        const initialPlay = _handlers.resolvePlayDefinition(state.selectedPlayKey)
        if (!initialPlay) {
          throw new Error('初始化玩法失敗')
        }
        state.activePlay = initialPlay
        state.selectedTypeName = initialPlay.playTypeNames[0] || ''
        state.selectedCodes = []
        state.fetchStatus = 'success'
      } catch (error) {
        state.fetchStatus = 'error'
        state.errorMessage = error instanceof Error ? error.message : '初始化失敗'
      }
    },
    submitBet: async () => {
      if (!canSubmit.value || !state.activePlay) {
        return
      }
      state.submitStatus = 'loading'
      state.errorMessage = ''
      state.message = ''
      try {
        /** @type {CreditBetPayload} */
        const payload = {
          playKey: state.activePlay.key,
          typeName: state.selectedTypeName,
          codes: [...state.selectedCodes],
          amount: Number(state.amount)
        }
        const groups = _handlers.toApiGroups(payload)
        const result = await api.lottery.bet({
          lottery: {
            id: LOTTERY['LHC-CD'].id,
            key: LOTTERY['LHC-CD'].key
          },
          amount: Number(state.amount),
          groups
        })
        state.lastOrderId = String(result?.orderId || '')
        state.lastOrders = Array.isArray(result?.orders) ? result.orders : []
        state.submitStatus = 'success'
        state.message = `下注成功，共 ${state.selectedCodes.length} 筆，單號 ${state.lastOrderId || '-'}`
      } catch (error) {
        state.submitStatus = 'error'
        state.errorMessage = _handlers.getErrorMessage(error)
      }
    }
  }

  const _handlers = {
    resolvePlayDefinition: (playKey) => {
      return CREDIT_PLAY_DEFINITIONS.find((item) => item.key === playKey) || null
    },
    toApiGroups: (payload) => {
      const optionMap = new Map(
        _handlers.getTypeOptions(state.activePlay, payload.typeName)
          .map((option) => [String(option.label), option])
      )
      return [
        {
          playKey: payload.playKey,
          playTypeName: payload.typeName,
          playList: payload.codes.map((code, index) => {
            const option = optionMap.get(String(code))
            const num = Number(code)
            return {
              playId: option?.id || `${payload.playKey}-${payload.typeName}-${index + 1}`,
              label: code,
              num: Number.isFinite(num) && num > 0 ? num : undefined,
              amount: payload.amount
            }
          })
        }
      ]
    },
    getTypeOptions: (play, typeName) => {
      if (!play || !typeName) {
        return []
      }
      const map = play.playTypeOptions || {}
      const options = map[typeName]
      return Array.isArray(options) ? options : []
    },
    getErrorMessage: (error) => {
      if (error?.data?.statusMessage) {
        return String(error.data.statusMessage)
      }
      if (error instanceof Error) {
        return error.message
      }
      return '下注失敗，請稍後重試'
    }
  }

  return {
    state,
    playList,
    availableCodes,
    canSubmit,
    click,
    actions: _actions
  }
}

