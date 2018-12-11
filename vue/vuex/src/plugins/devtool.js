const devtoolHook =
  typeof window !== 'undefined' &&
  window.__VUE_DEVTOOLS_GLOBAL_HOOK__

export default function devtoolPlugin(store) {
  if (!devtoolHook) return

  // true
  store._devtoolHook = devtoolHook
  // __VUE_DEVTOOLS_GLOBAL_HOOK__ 是一个 vm
  devtoolHook.emit('vuex:init', store)

  // devtool 原来是通过 emit 和 on 来记录操作的， 难怪经常会有延迟。
  devtoolHook.on('vuex:travel-to-state', targetState => {
    store.replaceState(targetState)
  })


  store.subscribe((mutation, state) => {
    devtoolHook.emit('vuex:mutation', mutation, state)
  })
}
