// vue router 的两个组件
import View from './components/view'
import Link from './components/link'

export let _Vue

export function install(Vue) {
  // 已经执行过 vue-router 的 install 方法
  if (install.installed && _Vue === Vue) return
  // TODO: 标识 install 函数的执行，但是这里的 install 是指的什么对象 ？ Vue 指的应该是 window.Vue 吧 ？
  install.installed = true
  _Vue = Vue
  // 判断非 undefined 函数
  const isDef = v => v !== undefined

  // TODO: Vnode 是什么？_parentVnode 又是啥
  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    // TODO: registerRouteInstance
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  // 为全局所有的 Vue 组件添加 beforeCreate 和 destroyed 两个 router 的生命周期函数
  Vue.mixin({
    beforeCreate() {
      // vue-cli 初始化的项目，一般是在 main.js 中, 调用 new Vue 的时候传入了一个 router， 
      // 相当于只有一个“根 Vue” 在初始化的时候，才会得到一个 router 参数
      if (isDef(this.$options.router)) {
        // 为 Vue 根组件 的实例上添加这几个属性，
        this._routerRoot = this // 指向本身
        this._router = this.$options.router // 指向 VueRouter 实例
        // TODO: 实例拥有一个 init 函数？
        this._router.init(this)
        // TODO: 
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        // 如果不是 根组件 的话（而是子组件），_routerRoot 的值就是指向 子节点的 父节点 的 _routerRoot。 
        // 而父节点的 _routerRoot 值是它的父节点的 _routerRoot， 所以其实理论上来说，就是 根组件
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      // TODO: 这个函数执行的参数看起来真的很诡异，传入了两个 this
      registerInstance(this, this)
    },
    destroyed() {
      registerInstance(this)
    }
  })

  // Object.defineProperty 为对象添加的属性，可以具有 set 和 get 监听方法。
  // TODO: 不过既然这里只有一个 get 函数，为什么需要使用 Object.defineProperty， 而不是直接在 Vue 的原型脸上添加 router 的两个属性？
  Object.defineProperty(Vue.prototype, '$router', {
    get() { return this._routerRoot._router }
  })

  Object.defineProperty(Vue.prototype, '$route', {
    get() { return this._routerRoot._route }
  })

  // <router-view></router-view> router 的容器组件
  Vue.component('RouterView', View)
  // router-link 点击的标签组件，实际会被编译成 a 标签
  Vue.component('RouterLink', Link)

  // TODO: 我记得这样的 config 是为了给 Vue 添加一些全局属性， 而这些属性要通过 Vue.config.xxx 这样的形式来拿，不会被继承到 vue 实例中去
  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  // TODO: 看不懂这一步操作是啥
  // beforeRouteEnter beforeRouteLeave beforeRouteUpdate 这几个都是单个的 vue 实例中的路由守卫函数，并不是实际在 vue-router 进行声明的呀？
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
