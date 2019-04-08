// 为 Vue 添加全局的API，也就是静态的方法和属性。属性和方法都是挂载在 Vue 这个构造函数上的。
import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

// 这些全局API以静态属性和方法的形式被添加到 Vue 构造函数上
export function initGlobalAPI(Vue: GlobalAPI) {

  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      // 不要设置自定义的字段和对象替换 Vue 的 config 对象
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // Vue 构造函数上挂载 config 属性，只读的属性
  Object.defineProperty(Vue, 'config', configDef)

  // 暴露一些工具函数
  // @note: 这些不被认为是公共API的一部分， 除非你意识到其中的风险避免依赖这些函数
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // Vue.set 和 del 函数是设置或者删除一些新的属性被 Vue 观察，因为对于一开始不存在的对象的属性，Vue 的监听队列中是没有的，做不到响应式处理
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 是一个空的对象，通过 Object.create(null) 创建
  Vue.options = Object.create(null)

  // 'component', 'directive', 'filter'
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  // extend 函数的作用是将 builtInComponents 对象属性都扩展到 Vue.options.components 对象上
  // 暂时 components 是空对象，扩展 KeepAlive 属性值
  extend(Vue.options.components, builtInComponents)

  // 执行完上面的内容之后，options 变成了下面这样
  // Vue.options = {
  //   components: { KeepAlive },
  //   directives: Object.create(null),
  //   filters: Object.create(null),
  //   _base: Vue
  // }

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
