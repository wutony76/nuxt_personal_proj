import { reactive } from 'vue'

// Shared dialog state across the app
const state = reactive({
  visible: false,
  title: '温馨提醒',
  content: '',
  options: {},
  cb: null as any,
})

// #EMITE
const open = (content: string, options: any) => {
  click.open(content, options)
}
const close = () => {
  click.close()
}

// #HANDLE.FUNC
const click = {
  open: (content: string, options: any) => {
    state.options = Object.hasOwn(options, 'options') ? options.options : {}
    if (Object.hasOwn(options, 'title')) state.title = options.title
    if (Object.hasOwn(options, 'cb')) state.cb = options.cb

    state.content = content
    state.visible = true
  },
  ok: () => {
    if (state.cb) state.cb()
    state.visible = false
  },
  close: () => {
    state.visible = false
  },
}

export function useDialog() {
  return {
    state,
    click,
    open,
    close,
  }
}
