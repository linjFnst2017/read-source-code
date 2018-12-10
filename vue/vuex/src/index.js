import { Store, install } from './store'
import { mapState, mapMutations, mapGetters, mapActions, createNamespacedHelpers } from './helpers'

export default {
  // new Store() 创建一个 vuex 来使用
  Store,
  // todo: 如果需要添加 vuex 函数的话，估计可以挂载到 vuex 的原型链上去
  // https://segmentfault.com/a/1190000008521430 多次 import 同一个包，webpack 打包之后的效果
  install,
  // todo: 字符串有啥用？
  version: '__VERSION__',
  // helper 辅助函数的内容
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers
}
