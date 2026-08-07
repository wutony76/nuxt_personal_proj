import { STATUS_ERR_CODE } from '~/config/constants.js'

type ErrCodeKey = keyof typeof STATUS_ERR_CODE

/**
 * 以業務錯誤碼丟出 HTTP 錯誤（伺端統一入口）
 *
 * statusCode 一律送 STATUS_ERR_CODE 的 httpStatus（真正的 HTTP status），
 * 業務碼放進 data.code —— 不可把 40001 這類業務碼直接當 statusCode：
 * h3 會因為超出合法範圍退成 500，而 500 在 ofetch 預設 retryStatusCodes 內，
 * GET 請求會被自動重試一次，變成同一個錯誤送兩次。
 *
 * statusMessage 與 message 都帶（h3 未來會 sanitize statusMessage），
 * 前端兩者皆可取；業務碼則以 err.data?.data?.code 取用。
 */
export function throwErrCode(key: ErrCodeKey, message?: string): never {
  const err = STATUS_ERR_CODE[key]
  const text = message || err.message
  throw createError({
    statusCode: err.httpStatus,
    statusMessage: text,
    message: text,
    data: { code: err.code },
  })
}
