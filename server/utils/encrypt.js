import Base64 from 'crypto-js/enc-base64'
import encUtf8 from 'crypto-js/enc-utf8'
import sha256 from 'crypto-js/sha256'
import Hex from 'crypto-js/enc-hex'
import { hashSync } from 'bcryptjs'

export function APIEncryptParams(obj) {
  if (!window.getRPCJsonParam) return obj
  return JSON.parse(window.getRPCJsonParam(obj.cmd, JSON.stringify(obj)))
}

function getRandomInt(max, min = 0) {
  return Math.floor(Math.random() * (max + 1 - min)) + min
}

export function _uuid() {
  let d = Date.now()
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (d + Math.random() * 16) % 16 | 0
    d = Math.floor(d / 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function _uuid2() {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  const b64 = typeof btoa === 'function' ? btoa(binary) : ''
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function encodeBase64(_data) {
  return Base64.stringify(encUtf8.parse(_data))
}

export function decodeBase64(_dataB64) {
  try {
    return Base64.parse(_dataB64).toString(encUtf8)
  } catch {
    return _dataB64
  }
}

export function encodeSelf(_data, key) {
  if (!_data || !key) return ''
  const _dataLen = _data.toString().length
  const _keyLen = key.toString().length
  let args = -1
  const args2 = []
  const sliceData = []
  const sliceKey = []

  let rIndex2 = 0
  args = getRandomInt(_dataLen - 1, 1)
  sliceData.push(_data.slice(0, args))
  sliceData.push(_data.slice(args, _dataLen))

  for (let i = 0; i < 2; i++) {
    const len = key.toString().length - rIndex2
    const count = 2 - i
    rIndex2 = getRandomInt((len - 1) / count, 1)
    args2.push(rIndex2)
  }

  args2.forEach((arg, i) => {
    const st = i === 0 ? 0 : args2[i - 1]
    const ed = i === 0 ? arg : arg + args2[i - 1]
    sliceKey.push(key.slice(st, ed))
  })
  sliceKey.push(
    key.slice(
      args2.reduce((prev, curr) => prev + curr, 0),
      _keyLen
    )
  )

  let out = ''
  sliceKey.forEach((item, i) => {
    let add = ''
    if (sliceData[i]) add = `${item}?${sliceData[i].length};${sliceData[i]}&`
    else add = `${item}`
    out += add
  })
  return encodeBase64(out)
}

export function decodeSelf(_dataSelf) {
  if (!_dataSelf) return ''
  let decodeStr = decodeBase64(_dataSelf)
  decodeStr = decodeStr.replaceAll('&', '?')
  const _arr = decodeStr.split('?')
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

const PASSWORD_SALT_ROUNDS = 12

export function encodePasswordBcjs(password) {
  return hashSync(password, PASSWORD_SALT_ROUNDS)
}

