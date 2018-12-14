const devtoolHook =
  typeof window !== 'undefined' &&
  // todo: 这个东西，估计是 devtool chrome 插件注入到 window 全局变量中的
  window.__VUE_DEVTOOLS_GLOBAL_HOOK__

export default function devtoolPlugin(store) {
  if (!devtoolHook) return

  // true
  store._devtoolHook = devtoolHook
  // __VUE_DEVTOOLS_GLOBAL_HOOK__ 值包含 1. Vue 构造方法 2. emit on off once 函数 3. store 实例
  devtoolHook.emit('vuex:init', store)

  // devtool 原来是通过 emit 和 on 来记录操作的， 难怪经常会有延迟。
  devtoolHook.on('vuex:travel-to-state', targetState => {
    store.replaceState(targetState)
  })

  // 订阅 store 的 mutation。handler (就是这个回调函数) 会在每个 mutation 完成后调用，接收 mutation 和经过 mutation 后的状态作为参数：
  store.subscribe((mutation, state) => {
    devtoolHook.emit('vuex:mutation', mutation, state)
  })
}
