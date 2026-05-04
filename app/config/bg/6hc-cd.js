/**
 * @typedef {Object} CreditPlayDefinition
 * @property {string} key
 * @property {string} name
 * @property {string} source
 * @property {string} description
 * @property {string[]} playTypeNames
 * @property {string[]} groupNames
 * @property {Record<string, Array<{id:string,label:string,num?:number}>>} playTypeOptions
 */

const makeNumberOptions = (prefix) => {
  return Array.from({ length: 49 }, (_, index) => {
    const num = index + 1
    const label = String(num).padStart(2, '0')
    return {
      id: `${prefix}-${label}`,
      label,
      num
    }
  })
}

const makeSimpleOptions = (prefix, labels) => {
  return labels.map((label, index) => ({
    id: `${prefix}-${index + 1}`,
    label
  }))
}

const TEMA_SIDE_OPTIONS = ['特大', '特小', '特單', '特雙', '合單', '合雙', '尾大', '尾小']
const COLOR_OPTIONS = ['紅波', '藍波', '綠波']
const BANBO_OPTIONS = [
  '紅單', '紅雙', '紅大', '紅小',
  '藍單', '藍雙', '藍大', '藍小',
  '綠單', '綠雙', '綠大', '綠小'
]
const SHENGXIAO_OPTIONS = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬']

/** @type {CreditPlayDefinition[]} */
export const CREDIT_PLAY_DEFINITIONS = [
  {
    key: 'banbo',
    name: '半波',
    source: 'config_banbo.js',
    description: '色波、單雙、大小與合數等組合玩法。',
    playTypeNames: ['半波'],
    groupNames: ['半波'],
    playTypeOptions: {
      半波: makeSimpleOptions('banbo-half', BANBO_OPTIONS)
    }
  },
  {
    key: 'duoxuanzhongyi',
    name: '中一',
    source: 'config_duoxuanzhongyi.js',
    description: '多選中一類型，命中任一指定條件即成立。',
    playTypeNames: ['五選中一', '六選中一', '七選中一', '八選中一', '九選中一', '十選中一'],
    groupNames: ['中一'],
    playTypeOptions: {
      五選中一: makeNumberOptions('duoxuanzhongyi-5'),
      六選中一: makeNumberOptions('duoxuanzhongyi-6'),
      七選中一: makeNumberOptions('duoxuanzhongyi-7'),
      八選中一: makeNumberOptions('duoxuanzhongyi-8'),
      九選中一: makeNumberOptions('duoxuanzhongyi-9'),
      十選中一: makeNumberOptions('duoxuanzhongyi-10')
    }
  },
  {
    key: 'ixiaolian',
    name: '一肖連',
    source: 'config_ixiaolian.js',
    description: '以生肖關聯作為主要投注條件。',
    playTypeNames: ['一肖量'],
    groupNames: ['一肖量'],
    playTypeOptions: {
      一肖量: makeSimpleOptions('ixiaolian-animal', ['特肖', '一肖中', '一肖不中', '二肖連中', '三肖連中', '四肖連中'])
    }
  },
  {
    key: 'lianma',
    name: '連碼',
    source: 'config_lianma.js',
    description: '多號連動投注，依組合中獎條件判定。',
    playTypeNames: ['三全中', '三中二', '二全中', '二中特', '特串'],
    groupNames: ['連碼'],
    playTypeOptions: {
      三全中: makeSimpleOptions('lianma-3all', ['三全中']),
      三中二: makeSimpleOptions('lianma-3in2', ['三中二之中三', '三中二之中二']),
      二全中: makeSimpleOptions('lianma-2all', ['二全中']),
      二中特: makeSimpleOptions('lianma-2tema', ['二中特之中特', '二中特之中二']),
      特串: makeSimpleOptions('lianma-chain', ['特串'])
    }
  },
  {
    key: 'qima',
    name: '七码',
    source: 'config_qima.js',
    description: '七碼範圍玩法，偏向擴大覆蓋型態。',
    playTypeNames: ['七码'],
    groupNames: ['單雙', '大小'],
    playTypeOptions: {
      七碼: makeSimpleOptions('qima-7', ['單1', '單2', '單3', '單4', '雙1', '雙2', '雙3', '雙4', '大1', '大2', '大3', '大4', '小1', '小2', '小3', '小4'])
    }
  },
  {
    key: 'shengxiao',
    name: '生肖',
    source: 'config_shengxiao.js',
    description: '特肖、一肖、合肖與連肖等生肖延伸玩法。',
    playTypeNames: ['特肖'],
    groupNames: ['特肖'],
    playTypeOptions: {
      特肖: makeSimpleOptions('shengxiao-special', SHENGXIAO_OPTIONS)
    }
  },
  {
    key: 'tema',
    name: '特碼',
    source: 'config_tema.js',
    description: '特碼主玩法，包含兩面與色波相關內容。',
    playTypeNames: ['特碼A', '特碼B'],
    groupNames: ['特碼', '兩面', '色波'],
    playTypeOptions: {
      特碼A: [
        ...makeNumberOptions('tema-a-num'),
        ...makeSimpleOptions('tema-a-side', TEMA_SIDE_OPTIONS),
        ...makeSimpleOptions('tema-a-color', COLOR_OPTIONS)
      ],
      特碼B: [
        ...makeNumberOptions('tema-b-num'),
        ...makeSimpleOptions('tema-b-side', TEMA_SIDE_OPTIONS),
        ...makeSimpleOptions('tema-b-color', COLOR_OPTIONS)
      ]
    }
  },
  {
    key: 'touweishu',
    name: '頭尾數',
    source: 'config_touweishu.js',
    description: '頭數、尾數與連尾的綜合玩法。',
    playTypeNames: ['尾數中', '尾數不中'],
    groupNames: ['尾數'],
    playTypeOptions: {
      尾數中: makeSimpleOptions('touweishu-in', ['0尾', '1尾', '2尾', '3尾', '4尾', '5尾', '6尾', '7尾', '8尾', '9尾']),
      尾數不中: makeSimpleOptions('touweishu-not', ['0尾', '1尾', '2尾', '3尾', '4尾', '5尾', '6尾', '7尾', '8尾', '9尾'])
    }
  },
  {
    key: 'weishulian',
    name: '尾數連',
    source: 'config_weishulian.js',
    description: '尾數串連投注，強調尾數組合。',
    playTypeNames: ['尾數量'],
    groupNames: ['尾數量'],
    playTypeOptions: {
      尾數量: makeSimpleOptions('weishulian-tail', ['二尾連中', '三尾連中', '四尾連中', '二尾連不中', '三尾連不中', '四尾連不中'])
    }
  },
  {
    key: 'wuxing',
    name: '五行',
    source: 'config_wuxing.js',
    description: '以五行分類對應號碼進行投注。',
    playTypeNames: ['五行'],
    groupNames: ['五行'],
    playTypeOptions: {
      五行: makeSimpleOptions('wuxing', ['金', '木', '水', '火', '土'])
    }
  },
  {
    key: 'zhengma',
    name: '正碼',
    source: 'config_zhengma.js',
    description: '正碼與過關玩法的主體入口。',
    playTypeNames: ['正碼A', '正碼B'],
    groupNames: ['正碼', '兩面'],
    playTypeOptions: {
      正碼A: [
        ...makeNumberOptions('zhengma-a-num'),
        ...makeSimpleOptions('zhengma-a-side', ['總單', '總雙', '總大', '總小'])
      ],
      正碼B: [
        ...makeNumberOptions('zhengma-b-num'),
        ...makeSimpleOptions('zhengma-b-side', ['總單', '總雙', '總大', '總小'])
      ]
    }
  },
  {
    key: 'zhengmate',
    name: '正碼特',
    source: 'config_zhengmate.js',
    description: '正碼特別玩法，強調單項命中結果。',
    playTypeNames: ['正一特', '正二特', '正三特', '正四特', '正五特', '正六特'],
    groupNames: ['正一特', '兩面', '色波'],
    playTypeOptions: {
      正一特: [...makeNumberOptions('zhengmate-1-num'), ...makeSimpleOptions('zhengmate-1-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-1-color', COLOR_OPTIONS)],
      正二特: [...makeNumberOptions('zhengmate-2-num'), ...makeSimpleOptions('zhengmate-2-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-2-color', COLOR_OPTIONS)],
      正三特: [...makeNumberOptions('zhengmate-3-num'), ...makeSimpleOptions('zhengmate-3-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-3-color', COLOR_OPTIONS)],
      正四特: [...makeNumberOptions('zhengmate-4-num'), ...makeSimpleOptions('zhengmate-4-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-4-color', COLOR_OPTIONS)],
      正五特: [...makeNumberOptions('zhengmate-5-num'), ...makeSimpleOptions('zhengmate-5-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-5-color', COLOR_OPTIONS)],
      正六特: [...makeNumberOptions('zhengmate-6-num'), ...makeSimpleOptions('zhengmate-6-side', TEMA_SIDE_OPTIONS), ...makeSimpleOptions('zhengmate-6-color', COLOR_OPTIONS)]
    }
  },
  {
    key: 'zhengterenzhong',
    name: '正特人中',
    source: 'config_zhengterenzhong.js',
    description: '特平中系列玩法。',
    playTypeNames: ['一粒任中', '二粒任中', '三粒任中', '四粒任中', '五粒任中'],
    groupNames: ['任中'],
    playTypeOptions: {
      一粒任中: makeNumberOptions('zhengterenzhong-1'),
      二粒任中: makeNumberOptions('zhengterenzhong-2'),
      三粒任中: makeNumberOptions('zhengterenzhong-3'),
      四粒任中: makeNumberOptions('zhengterenzhong-4'),
      五粒任中: makeNumberOptions('zhengterenzhong-5')
    }
  },
  {
    key: 'zixuanbuzhong',
    name: '自選不中',
    source: 'config_zixuanbuzhong.js',
    description: '自選不中玩法，依不中條件計算結果。',
    playTypeNames: ['五不中', '六不中', '七不中', '八不中', '九不中', '十不中'],
    groupNames: ['不中'],
    playTypeOptions: {
      五不中: makeNumberOptions('zixuanbuzhong-5'),
      六不中: makeNumberOptions('zixuanbuzhong-6'),
      七不中: makeNumberOptions('zixuanbuzhong-7'),
      八不中: makeNumberOptions('zixuanbuzhong-8'),
      九不中: makeNumberOptions('zixuanbuzhong-9'),
      十不中: makeNumberOptions('zixuanbuzhong-10')
    }
  }
]

