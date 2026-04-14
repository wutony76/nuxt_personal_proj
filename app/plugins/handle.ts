import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin(() => {
  const _dialog = useDialog()
  const dialog = {
    alert: (content: string) => {
      _dialog.open(content, {
        type: 'none',
      })
    }
  }

  return {
    provide: {
      dialog,
    },
  }
})