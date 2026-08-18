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
 * ⚠️ 錯誤文案一律放 message，不要放 statusMessage —— statusMessage 是 HTTP 狀態列的
 * reason phrase，h3 會用 /[^	 -~]/g 消毒（只留 TAB 與可列印 ASCII），
 * 中文會被整段清空，且 createError 會噴
 * 「[h3] Please prefer using `message` ... statusMessage will be sanitized by default」。
 * 前端一律以 err.data?.message 取文案，業務碼則以 err.data?.data?.code 取用。
 */
export function throwErrCode(key: ErrCodeKey, message?: string): never {
  const err = STATUS_ERR_CODE[key]
  const text = message || err.message
  throw createError({
    statusCode: err.httpStatus,
    message: text,
    data: { code: err.code },
  })
}
