// Vue 构造函数的定义文件，我们一直都叫其 Vue 的出生文件，主要作用是定义 Vue 构造函数，并对其原型添加属性和方法，即实例属性和实例方法。函数和属性都是挂载在 Vue 的原型上的。
// 从五个文件导入五个方法（不包括 warn）
import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// 定义 Vue 构造函数, 将构造函数经过加工之后再对外抛出。
function Vue(options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    // 使用了安全模式来提醒你要使用 new 操作符来调用 Vue
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 当我们执行 new Vue() 的时候，this._init(options) 将被执行。
  this._init(options)
}

// *Mixin 方法的作用其实就是包装 Vue.prototype，在其上挂载一些属性和方法
// 将 Vue 作为参数传递给导入的五个方法
// 为Vue 原型链 定义了一个 _init 初始化函数
initMixin(Vue)
// 订阅 vue 实例中的 props 和 data ，将props 和 data 对象通过 Object.defineProperty() 方法扩展到 Vue 原型链上
stateMixin(Vue)
// 在Vue 原型链上定义了 $on, $once, $emit, $off 事件类型的实例方法
// 在不使用 Vuex的时候，跨组件之间的通信， eventBus 通过事件emit、on 传递参数是一个解决方法 eventBus
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

// 导出 Vue
export default Vue
