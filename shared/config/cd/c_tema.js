export default [
  {
    name: '特碼',
    key: 'tema',
    list: [
      {
        tabId: 2000,
        tabName: '特碼A',
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          }
        },
        tabGroup: [
          {
            groupName: '特碼',
            // 爆池分配權重（理論 49）
            weight: 3,
            // 特碼單號（49 選 1）：賠率統一對齊 shared/config/6hc-cd.ts 的 CREDIT_TEMA_ODDS.number
            groupList: [
              { playId: '2000-001', name: '01', odds: 48 },
              { playId: '2000-002', name: '02', odds: 48 },
              { playId: '2000-003', name: '03', odds: 48 },
              { playId: '2000-004', name: '04', odds: 48 },
              { playId: '2000-005', name: '05', odds: 48 },
              { playId: '2000-006', name: '06', odds: 48 },
              { playId: '2000-007', name: '07', odds: 48 },
              { playId: '2000-008', name: '08', odds: 48 },
              { playId: '2000-009', name: '09', odds: 48 },
              { playId: '2000-010', name: '10', odds: 48 },
              { playId: '2000-011', name: '11', odds: 48 },
              { playId: '2000-012', name: '12', odds: 48 },
              { playId: '2000-013', name: '13', odds: 48 },
              { playId: '2000-014', name: '14', odds: 48 },
              { playId: '2000-015', name: '15', odds: 48 },
              { playId: '2000-016', name: '16', odds: 48 },
              { playId: '2000-017', name: '17', odds: 48 },
              { playId: '2000-018', name: '18', odds: 48 },
              { playId: '2000-019', name: '19', odds: 48 },
              { playId: '2000-020', name: '20', odds: 48 },
              { playId: '2000-021', name: '21', odds: 48 },
              { playId: '2000-022', name: '22', odds: 48 },
              { playId: '2000-023', name: '23', odds: 48 },
              { playId: '2000-024', name: '24', odds: 48 },
              { playId: '2000-025', name: '25', odds: 48 },
              { playId: '2000-026', name: '26', odds: 48 },
              { playId: '2000-027', name: '27', odds: 48 },
              { playId: '2000-028', name: '28', odds: 48 },
              { playId: '2000-029', name: '29', odds: 48 },
              { playId: '2000-030', name: '30', odds: 48 },
              { playId: '2000-031', name: '31', odds: 48 },
              { playId: '2000-032', name: '32', odds: 48 },
              { playId: '2000-033', name: '33', odds: 48 },
              { playId: '2000-034', name: '34', odds: 48 },
              { playId: '2000-035', name: '35', odds: 48 },
              { playId: '2000-036', name: '36', odds: 48 },
              { playId: '2000-037', name: '37', odds: 48 },
              { playId: '2000-038', name: '38', odds: 48 },
              { playId: '2000-039', name: '39', odds: 48 },
              { playId: '2000-040', name: '40', odds: 48 },
              { playId: '2000-041', name: '41', odds: 48 },
              { playId: '2000-042', name: '42', odds: 48 },
              { playId: '2000-043', name: '43', odds: 48 },
              { playId: '2000-044', name: '44', odds: 48 },
              { playId: '2000-045', name: '45', odds: 48 },
              { playId: '2000-046', name: '46', odds: 48 },
              { playId: '2000-047', name: '47', odds: 48 },
              { playId: '2000-048', name: '48', odds: 48 },
              { playId: '2000-049', name: '49', odds: 48 },
            ],
          },
          {
            groupName: '兩面',
            // 爆池分配權重（理論 2）
            weight: 1,
            // 兩面（大小／單雙／合單雙／尾大小）：賠率對齊 CREDIT_TEMA_ODDS.side
            groupList: [
              { playId: '2000-101', name: '特大', odds: 1.98 },
              { playId: '2000-102', name: '特小', odds: 1.98 },
              { playId: '2000-103', name: '特單', odds: 1.98 },
              { playId: '2000-104', name: '特雙', odds: 1.98 },
              { playId: '2000-105', name: '合單', odds: 1.98 },
              { playId: '2000-106', name: '合雙', odds: 1.98 },
              { playId: '2000-107', name: '尾大', odds: 1.98 },
              { playId: '2000-108', name: '尾小', odds: 1.98 },
            ],
          },
          {
            groupName: '色波',
            // 爆池分配權重（理論 2.88 ~ 3.06）
            weight: 2,
            // 色波：賠率分別對齊 CREDIT_TEMA_ODDS.colorRed / colorBlue / colorGreen
            groupList: [
              { playId: '2000-201', name: '紅波', odds: 2.7 },
              { playId: '2000-202', name: '藍波', odds: 2.9 },
              { playId: '2000-203', name: '綠波', odds: 2.9 },
            ],
          },
        ],
      },
      {
        tabId: 2001,
        tabName: '特碼B',
        // 特碼B 定位為「大額投注」：投注額度上限明顯高於特碼A，
        // 賠率也刻意調低（對應風控／利潤空間），與特碼A（見上方 CREDIT_TEMA_ODDS 對齊值）做出區分
        // ⚠️ 注意：此處僅為前端顯示賠率，實際派彩仍由 shared/config/6hc-cd.ts 的
        // CREDIT_TEMA_ODDS／creditTemaOddsOf 統一計算（目前不分 tabId）。
        // 若要讓特碼B 真正以較低賠率派彩，需同步調整後端結算邏輯，否則會出現「顯示賠率」與
        // 「實際派彩」不一致的問題。
        settings: {
          quota: {
            item: { // 單注投注額
              min: 300, // 單注投注額最低 300 元
              max: 100000,
            },
            issue: { // 單期投注額
              max: 5000000,
            },
          }
        },
        tabGroup: [
          {
            groupName: '特碼',
            // 爆池分配權重（理論 49）
            weight: 3,
            groupList: [
              { playId: '2001-001', name: '01', odds: 45 },
              { playId: '2001-002', name: '02', odds: 45 },
              { playId: '2001-003', name: '03', odds: 45 },
              { playId: '2001-004', name: '04', odds: 45 },
              { playId: '2001-005', name: '05', odds: 45 },
              { playId: '2001-006', name: '06', odds: 45 },
              { playId: '2001-007', name: '07', odds: 45 },
              { playId: '2001-008', name: '08', odds: 45 },
              { playId: '2001-009', name: '09', odds: 45 },
              { playId: '2001-010', name: '10', odds: 45 },
              { playId: '2001-011', name: '11', odds: 45 },
              { playId: '2001-012', name: '12', odds: 45 },
              { playId: '2001-013', name: '13', odds: 45 },
              { playId: '2001-014', name: '14', odds: 45 },
              { playId: '2001-015', name: '15', odds: 45 },
              { playId: '2001-016', name: '16', odds: 45 },
              { playId: '2001-017', name: '17', odds: 45 },
              { playId: '2001-018', name: '18', odds: 45 },
              { playId: '2001-019', name: '19', odds: 45 },
              { playId: '2001-020', name: '20', odds: 45 },
              { playId: '2001-021', name: '21', odds: 45 },
              { playId: '2001-022', name: '22', odds: 45 },
              { playId: '2001-023', name: '23', odds: 45 },
              { playId: '2001-024', name: '24', odds: 45 },
              { playId: '2001-025', name: '25', odds: 45 },
              { playId: '2001-026', name: '26', odds: 45 },
              { playId: '2001-027', name: '27', odds: 45 },
              { playId: '2001-028', name: '28', odds: 45 },
              { playId: '2001-029', name: '29', odds: 45 },
              { playId: '2001-030', name: '30', odds: 45 },
              { playId: '2001-031', name: '31', odds: 45 },
              { playId: '2001-032', name: '32', odds: 45 },
              { playId: '2001-033', name: '33', odds: 45 },
              { playId: '2001-034', name: '34', odds: 45 },
              { playId: '2001-035', name: '35', odds: 45 },
              { playId: '2001-036', name: '36', odds: 45 },
              { playId: '2001-037', name: '37', odds: 45 },
              { playId: '2001-038', name: '38', odds: 45 },
              { playId: '2001-039', name: '39', odds: 45 },
              { playId: '2001-040', name: '40', odds: 45 },
              { playId: '2001-041', name: '41', odds: 45 },
              { playId: '2001-042', name: '42', odds: 45 },
              { playId: '2001-043', name: '43', odds: 45 },
              { playId: '2001-044', name: '44', odds: 45 },
              { playId: '2001-045', name: '45', odds: 45 },
              { playId: '2001-046', name: '46', odds: 45 },
              { playId: '2001-047', name: '47', odds: 45 },
              { playId: '2001-048', name: '48', odds: 45 },
              { playId: '2001-049', name: '49', odds: 45 },
            ],
          },
          {
            groupName: '兩面',
            // 爆池分配權重（理論 2）
            weight: 1,
            groupList: [
              { playId: '2001-101', name: '特大', odds: 1.92 },
              { playId: '2001-102', name: '特小', odds: 1.92 },
              { playId: '2001-103', name: '特單', odds: 1.92 },
              { playId: '2001-104', name: '特雙', odds: 1.92 },
              { playId: '2001-105', name: '合單', odds: 1.92 },
              { playId: '2001-106', name: '合雙', odds: 1.92 },
              { playId: '2001-107', name: '尾大', odds: 1.92 },
              { playId: '2001-108', name: '尾小', odds: 1.92 },
            ],
          },
          {
            groupName: '色波',
            // 爆池分配權重（理論 2.88 ~ 3.06）
            weight: 2,
            groupList: [
              { playId: '2001-201', name: '紅波', odds: 2.6 },
              { playId: '2001-202', name: '藍波', odds: 2.8 },
              { playId: '2001-203', name: '綠波', odds: 2.8 },
            ],
          },
        ],
      },
    ],
  },
]
