export function APIEncryptParams(obj) {
  if (!window.getRPCJsonParam) return obj
  return JSON.parse(window.getRPCJsonParam(obj.cmd, JSON.stringify(obj)))
}

import Base64 from 'crypto-js/enc-base64'
import encUtf8 from 'crypto-js/enc-utf8'
import sha256 from 'crypto-js/sha256'
import Hex from 'crypto-js/enc-hex'

function getRandomInt(max, min = 0) {
  return Math.floor(Math.random() * (max + 1 - min)) + min
}

// __UUID__
export function _uuid() {
  var d = Date.now()
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now() //use high-precision timer if available
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (d + Math.random() * 16) % 16 | 0
    d = Math.floor(d / 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
// __短UUID(b64url)__
export function _uuid2() {
  const bytes = new Uint8Array(16) // 宣告一個 128bit 空間
  globalThis.crypto.getRandomValues(bytes) // 填入隨機值
  let binary = '' // 將 bytes 轉換為 binary 字串
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  const b64 = // 將 binary 字串轉換為 b64url 字串
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
// __BASE64__
export function encodeBase64(_data) {
  return Base64.stringify(encUtf8.parse(_data))
}
export function decodeBase64(_dataB64) {
  try {
    return Base64.parse(_dataB64).toString(encUtf8)
  } catch (e) {
    console.log('err.decodeBase64.', _dataB64)
    return _dataB64
  }
}
// __Encode.Self__
export function encodeSelf(_data, key) {
  if (!_data || !key) return ''
  // console.log('d.', _data)
  // console.log('k.', key)
  const _dataLen = _data.toString().length
  const _keyLen = key.toString().length
  let args = -1 // _data.index切割位置
  const args2 = [] // key.index切割位置
  const sliceData = [] // _data 切割位置
  const sliceKey = [] // key 切割位置

  let rIndex = 0
  let rIndex2 = 0
  args = getRandomInt(_dataLen - 1, 1)
  // console.log('args.', args, _data.slice(0, args))
  sliceData.push(_data.slice(0, args))
  sliceData.push(_data.slice(args, _dataLen))
  // console.log('sliceData.', sliceData)
  for (let i = 0; i < 2; i++) {
    const len = key.toString().length - rIndex2
    const count = 2 - i
    rIndex2 = getRandomInt((len - 1) / count, 1)
    // console.log('r.', len, count)
    args2.push(rIndex2)
  }
  // console.log('args2.', args2)
  args2.forEach((arg, i) => {
    // console.log('arg', arg, i)
    let st = i === 0 ? 0 : args2[i - 1]
    let ed = i === 0 ? arg : arg + args2[i - 1]
    // console.log('arg.pos', st, ed)
    sliceKey.push(key.slice(st, ed))
  })
  sliceKey.push(
    key.slice(
      args2.reduce((prev, curr) => prev + curr, 0),
      _keyLen
    )
  )
  // console.log('sliceKey.', sliceKey)

  let out = ''
  sliceKey.forEach((sliceKey, i) => {
    let add = ''
    if (sliceData[i]) add = `${sliceKey}?${sliceData[i].length};${sliceData[i]}&`
    else add = `${sliceKey}`
    out += add
  })
  // console.log('out', out)
  return encodeBase64(out)
}
export function decodeSelf(_dataSelf) {
  if (!_dataSelf) return ''
  let decodeStr = decodeBase64(_dataSelf)
  decodeStr = decodeStr.replaceAll('&', '?')
  const _arr = decodeStr.split('?')
  // console.log('decodeStr', decodeStr, _arr)
  let out = ''
  _arr.forEach((slice) => {
    if (slice.indexOf(';') === -1) return
    out += slice.split(';')[1]
  })
  return out
}

export function encodeSha1(inp, loginId) {
  return encodePassword(inp, loginId)
}

function sha256Hex(str) {
  return sha256(str).toString(Hex)
}
function hex2Base64(str) {
  return Base64.stringify(Hex.parse(str))
}

export function encodePassword(password, loginId) {
  return hex2Base64(sha256Hex(sha256Hex(loginId.toLowerCase()) + password))
}
