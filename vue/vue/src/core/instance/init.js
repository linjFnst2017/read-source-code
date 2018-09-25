/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin(Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    // _init 函数是被挂载在 Vue 对象的原型链上的，所以一般最终也是由 Vue 的一个实例进行调用
    // 所以这里的 vm 值就是 一个 Vue 实例， 就是this 的值
    const vm: Component = this
    // todo
    // 多个Vue组件按顺序初始化的时候， uid 有什么作用？
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // todo
    // 避免被观察？
    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    // todo
    // 既然有 _isComponent 这个属性，（看起来这个 options 可能是一个 Vue 实例）
    // 事实上 options 的值就是 index.js 中传过来的 Vue 构造函数啊！！
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // todo:
      // 优化内部组件实例化
      // 因为动态 options 合并非常缓慢，并且内部组件 options 都不需要特殊处理
      // 这个函数的作用是将 额外的 options 参数扩展到 vm的 options 中去， 相同的引用值 vm.$options
      initInternalComponent(vm, options)
    } else {
      // todo：
      // 如果 options 中的不是一个组件？ 就直接 merge options ？
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
  // todo
  // 为什么要 Object.create(...) 创建一个以 vm.constructor.options 为原型的对象 ？
  // opts 访问 vm.constructor.options 中的对象是访问的到的，导师 Object.keys() 将会是空的数组
  const opts = vm.$options = Object.create(vm.constructor.options)
  // 这样做是因为它比动态枚举更快。
  // doing this because it's faster than dynamic enumeration.
  // todo
  // 这里为什么不直接赋值，而要 声明一个 parentVnode 再赋值？
  const parentVnode = options._parentVnode

  // todo: 
  opts.parent = options.parent
  // todo: 
  opts._parentVnode = parentVnode

  // todo
  // 这里为什么不直接赋值，而要 声明一个 parentVnode 再赋值？
  // 这里使用对象的结构会非常方便
  const vnodeComponentOptions = parentVnode.componentOptions
  // todo: 
  opts.propsData = vnodeComponentOptions.propsData
  // todo: 
  opts._parentListeners = vnodeComponentOptions.listeners
  // todo: 
  opts._renderChildren = vnodeComponentOptions.children
  // todo: 
  opts._componentTag = vnodeComponentOptions.tag

  // todo: 
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// 从函数的名称看， 这个函数的作用是 对外排除 参数（一个构造函数） 的 options
export function resolveConstructorOptions(Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

function dedupe(latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
