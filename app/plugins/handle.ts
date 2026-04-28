import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin(() => {
  const _dialog = useDialog()
  type DialogAlertOptions = {
    title?: string
    cb?: () => void
    options?: Record<string, unknown>
  }
  const dialog = {
    alert: (content: string, options: DialogAlertOptions = {}) => {
      _dialog.open(content, {
        ...options,
        options: {
          type: 'none',
          ...(options.options || {}),
        }
      })
    }
  }

  return {
    provide: {
      dialog,
    },
  }
})