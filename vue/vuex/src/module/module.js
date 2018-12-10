import { forEachValue } from '../util'

// Base data struct for store's module, package with some attribute and method
// store 模块的基础数据结构，包含一些属性和方法的包
export default class Module {
  // todo: runtime 这个参数的意义不明确？
  constructor(rawModule, runtime) {
    this.runtime = runtime
    // Store some children item
    // 存储一些子模块
    this._children = Object.create(null)
    // Store the origin module object which passed by programmer
    this._rawModule = rawModule
    const rawState = rawModule.state

    // Store the origin module's state
    // state 支持函数声明的形式， state() { return {...} } return 一个对象
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
  }

  get namespaced() {
    return !!this._rawModule.namespaced
  }

  // addChild removeChild getChild 这几个函数一般只用于根节点删除子模块。当然 vuex 是允许在子组件中再声明子模块的。
  addChild(key, module) {
    this._children[key] = module
  }

  removeChild(key) {
    delete this._children[key]
  }

  getChild(key) {
    return this._children[key]
  }

  // todo 为什么是枚举更新的形式，而不是直接替换 _rawModule 为 rawModule ？
  update(rawModule) {
    this._rawModule.namespaced = rawModule.namespaced
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }

  forEachChild(fn) {
    forEachValue(this._children, fn)
  }

  // todo: 为什么这三个函数属于同一种类型的，明明可以不要重复写啊？ 不加一个函数进行封装一下？
  forEachGetter(fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn)
    }
  }

  forEachAction(fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn)
    }
  }

  forEachMutation(fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
