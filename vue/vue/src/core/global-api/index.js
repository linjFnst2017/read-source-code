/* @flow */

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

// 参数 Vue 是经过各种加工的 Vue 构造函数
export function initGlobalAPI(Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      // 不要设置单独的字段替换 Vue 的 config 对象
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // Vue 构造函数上挂载 config 属性，不可修改
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

  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
