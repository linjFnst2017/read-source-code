export default function (Vue) {
  // 获取 Vue 的版本
  const version = Number(Vue.version.split('.')[0])

  if (version >= 2) {
    // 设计模式 mixin
    // 在javascript中，我们没办法通过接口继承的方式，但是我们可以通过javascript特有的原型链属性，将功能引用复制到原型链上，达到功能的注入。
    // vue.mixin 全局注册一个混合，影响注册之后所有创建的每个 Vue 实例。
    // todo: beforeCreate 是 Vue 实例的一个生命周期函数，这里不是把默认的 beforeCreate 函数给覆盖么？
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // override init and inject vuex init procedure
    // for 1.x backwards compatibility.
    // 兼容 vue@2 以下的版本， 通过重写 _init 函数
    const _init = Vue.prototype._init
    Vue.prototype._init = function (options = {}) {
      options.init = options.init
        // 如果 vue 初始化的时候， 传入的 option 参数中有 init 函数，就将 init 声明为一个数组，值为 vuex init 和原来的 init 函数
        ? [vuexInit].concat(options.init)
        : vuexInit
      // 执行 vue@1.x 的初始化函数
      _init.call(this, options)
    }
  }

  /**
   * Vuex init hook, injected into each instances init hooks list.
   * 第一次将 store 挂载到根实例上去， 是在 main.js 中 new Vue({ ..., store: new Store({}) })
   */

  function vuexInit() {
    // this 指向实际调用 vuexInit 的实例 (即每一个 vue 组件实例)，指的是实际的 Vue instance
    // $options 指的是每一个 Vue 实例输入的参数， 包括 data, computed, methods 以及生命周期函数
    const options = this.$options
    // store injection
    if (options.store) {
      // new Vuex() 实际上应该是一个对象， 但是也只是传一个函数进来，函数内需要包含 new Vuex() 声明函数
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } else if (options.parent && options.parent.$store) {
      // 实际上，这里对于子组件本身没有声明 store 的情况下，就去拿 parent 组件的 store
      // 这里是一个循环过程， 从根节点开始，（根节点是挂载了 store 的，有且仅有一个主动挂载 store 的实例）一步一步将 store 从 parent 组件往下传到了最底层的 Vue 实例中。
      this.$store = options.parent.$store
    }
  }
}
