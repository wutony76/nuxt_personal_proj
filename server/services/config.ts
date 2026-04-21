import lodash from 'lodash'
import { Storage } from './storage'
import { PLAYLIST } from '~/config/bg/6hc-of'
import { LOTTERY } from '~/config/constants'

const { cloneDeep } = lodash

export default class ConfigClass {
  isMock: boolean

  constructor() {
    this.isMock = true
    this.init()
  }

  init() {
    console.log('ConfigClass.init')
    this.handle.LHC()
  }

  handle = {
    LHC: () => {
      const lhc: Record<string, unknown> = (Storage.config.LHC = {})
      cloneDeep(PLAYLIST.slice(0, 49)).forEach((play) => {
        const _id = `${LOTTERY['6HC'].id}${String(play.num).padStart(3, '0')}`
        play.dbId = _id
        play.selected = true
        if (this.isMock) {
          play.countIssue = Math.floor(Math.random() * 100)
          play.countShow = Math.floor(Math.random() * 100)
        }
        lhc[_id] = play
      })
    }
  }
}