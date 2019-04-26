/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

// initExtend 方法在 Vue 上添加了 Vue.cid 静态属性，和 Vue.extend 静态方法。
export function initExtend(Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   * 类继承
   * Vue.extend 的作用就是构造一个 Vue 的子类，它使用一种非常经典的原型继承的方式把一个纯对象转换一个继承于 Vue 的构造器 Sub 并返回
   * 然后对 Sub 这个对象本身扩展了一些属性，如扩展 options、添加全局 API 等；并且对配置中的 props 和 computed 做了初始化工作；
   * 最后对于这个 Sub 构造函数做了缓存，避免多次执行 Vue.extend 的时候对同一个子组件重复构造
   */
  Vue.extend = function (extendOptions: Object): Function {
    // 扩展的属性，原理就是讲扩展的属性添加到父类的构造函数上去？
    extendOptions = extendOptions || {}
    // this 这里指的是 Vue ？ 应该该有其他从 Vue 类上继承并被继承的父类构造函数
    const Super = this
    // 开始的时候 Vue.cid = 0
    const SuperId = Super.cid
    // 缓存对象挂载
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})

    // 缓存中如果存在该子类，就直接从缓存中读取
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }
    // 组件的名称
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    // _init 函数只挂载到了 Vue 实例上，也就是说 this 肯定都是 Vue 类或者其子类的子代
    // 实例化 Sub 的时候，就会执行 this._init 逻辑再次走到了 Vue 实例的初始化逻辑
    const Sub = function VueComponent(options) {
      this._init(options)
    }
    // 非常经典的原型继承的方式把一个纯对象转换一个继承于 Vue 的构造器 Sub
    // 也就是 Sub 继承于 Super 这个类
    Sub.prototype = Object.create(Super.prototype)
    // 原型链上的构造函数指向本身
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
    // 处理 merge 合并 options。现象是，最终是把 Sub.options.components 合并到 vm.$options.components 上
    // 也就是说这里的 mergeOptions 是将原型上的 options 和将要扩展的 options 属性进行合并，
    // 而 Vue.options 上拥有一些全局的资源，比如全局组件、指令、过滤器等，这些都是通过 extend 函数 merge 到了一个新的 options 上
    // 从而实现了子组件上能够直接使用全局注册的资源
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // 父类的构造函数 子类中 this.super() 执行父类构造函数
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      // 初始化 props， 将 props 上所有的属性都代理到 _props 中
      initProps(Sub)
    }

    if (Sub.options.computed) {
      // 初始化 computed
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    // Vue 原型上的方法传递下去，子类同样也可以调用
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    // 这三个在 vue 中被称为资源，'component','directive','filter'
    ASSET_TYPES.forEach(function (type) {
      // 直接将三字资源从父类中获取赋值
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    // TODO: 自身引用自身 ？
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    // 将父类的 options 保存一份
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    // 缓存构造函数，下次扩展同一个子类的时候可以直接读取
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps(Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed(Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    // computed[key] 是一个没有参数的函数
    // 在原型链上挂载计算属性。 TODO: 为什么直接挂载原型链上 ？ 而不是通过代理的形式 ?
    defineComputed(Comp.prototype, key, computed[key])
  }
}
