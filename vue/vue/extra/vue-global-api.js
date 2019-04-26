// initGlobalAPI
Vue.config
Vue.util = {
  warn,
  extend,
  mergeOptions,
  defineReactive
}
Vue.set = set
Vue.delete = del
Vue.nextTick = nextTick

// 局部注册资源： 在组件的 Vue 的实例化阶段有一个合并 option 的逻辑，把 components 合并到 vm.$options.components 上，
// 这样就可以在 resolveAsset 的时候拿到这个组件的构造函数，并作为 createComponent 的钩子的参数
// 局部注册和全局注册不同的是，只有该类型的组件才可以访问局部注册的子组件，而全局注册是扩展到 Vue.options 下，
// 所以在所有组件创建的过程中，都会从全局的 Vue.options.components 扩展到当前组件的 vm.$options.components 下，这就是全局注册的组件能被任意使用的原因
Vue.options = {
  components: {
    KeepAlive
    // Transition 和 TransitionGroup 组件在 runtime/index.js 文件中被添加
    // Transition,
    // TransitionGroup
  },
  directives: Object.create(null),
  // 在 runtime/index.js 文件中，为 directives 添加了两个平台化的指令 model 和 show
  // directives:{
  //	model,
  //	show
  // },
  filters: Object.create(null),
  _base: Vue
}

// initUse ***************** global-api/use.js
Vue.use = function (plugin: Function | Object) { }

// initMixin ***************** global-api/mixin.js
Vue.mixin = function (mixin: Object) { }

// initExtend ***************** global-api/extend.js
Vue.cid = 0
Vue.extend = function (extendOptions: Object): Function { }

// initAssetRegisters ***************** global-api/assets.js
Vue.component =
  Vue.directive =
  Vue.filter = function (
    id: string,
    definition: Function | Object
  ): Function | Object | void { }

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

// entry-runtime-with-compiler.js
Vue.compile = compileToFunctions