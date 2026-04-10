export const LHC_COLORS = {
  red: ['01', '02', '07', '08', '12', '13', '18', '19', '23', '24', '29', '30', '34', '35', '40', '45', '46', '红波'],
  blue: ['03', '04', '09', '10', '14', '15', '20', '25', '26', '31', '36', '37', '41', '42', '47', '48', '蓝波'],
  green: ['05', '06', '11', '16', '17', '21', '22', '27', '28', '32', '33', '38', '39', '43', '44', '49', '绿波'],
}

export const PLAYLIST = Array.from(new Array(50), (val, index) => index + 1).map((i) => ({
  id: i,
  num: i,
  countIssue: -1, //'-', // 號碼攪出相隔期數
  countShow: -1, // 號碼攪出次數
  odds: -1,
  label: String(i).padStart(2, '0'),
  show: true,
  colorY: false,
  selected: false,
}))