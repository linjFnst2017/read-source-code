import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// 将构造函数经过加工之后再对外抛出。
function Vue(options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

// 为Vue 原型链 定义了一个 _init 初始化函数
initMixin(Vue)

// 订阅 vue 实例中的 props 和 data ，将props 和 data 对象通过 Object.defineProperty() 方法扩展到 Vue 原型链上
stateMixin(Vue)

// 在Vue 原型链上定义了 $on, $once, $emit, $off 事件类型的实例方法
// 在不使用 Vuex的时候，跨组件之间的通信， eventBus 通过事件emit、on 传递参数是一个解决方法 eventBus
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
