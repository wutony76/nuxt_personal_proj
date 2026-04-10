import { cloneDeep } from 'lodash-es'
import { reactive } from 'vue'
import { GAME_6HC_OF } from '~/config/constants'
import { PLAYLIST } from '~/config/bg/6hc-of'


const state = reactive({
  status: 'NONE' as String,
  playList: [] as any[],
})
const handle = {
  newGame: (_status: String) => {
    if (_status) state.status = _status
    state.playList = init.playList(_status)
  }
}
const init = {
  playList: (status: String) => {
    switch (status) {
      case GAME_6HC_OF.SINGLE:
        return cloneDeep(PLAYLIST.slice(0, 49))
      case GAME_6HC_OF.DUPLEX:
      case GAME_6HC_OF.DANTUO:
        return cloneDeep(PLAYLIST)
      default:
        return []
    }
  },
}

export function use6hcOfficial() {
  return { state, handle }
}