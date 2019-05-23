import { Store, install } from './store'
import { mapState, mapMutations, mapGetters, mapActions, createNamespacedHelpers } from './helpers'

export default {
  // new Store() 创建一个 vuex 来使用
  Store,
  // 不同文件中多次import同一个文件，webpack并不会多次打包，只会在打包后的文件中会多次引用打包后的该文件对应的函数
  // TODO: 如果需要添加 vuex 函数的话，估计可以挂载到 vuex 的原型链上去
  // 不过这里的 install 暴露出去貌似也没什么用吧？
  install,
  // __VERSION__ 打包的时候会被替换成具体的版本号
  version: '__VERSION__',
  // helper 辅助函数的内容
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  // 用的比较少
  createNamespacedHelpers
}
