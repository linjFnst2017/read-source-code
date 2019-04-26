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

export function initMixin(Vue) {
  Vue.prototype._init = function (options) {
    // _init 函数是被挂载在 Vue 对象的原型链上的，最终也是由 Vue 的一个实例进行调用, this._init(options)
    // 这里的 vm 值就是 一个 Vue 实例， 就是 this 的值
    const vm = this
    // 多个Vue组件按顺序初始化的时候， uid 应该是可以用来起缓存作用的？ 更快查询实例？
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    // config 的值跟只读属性 Vue.config 指向的是同一个值， Vue 提供了全局配置 Vue.config.performance
    // config.performance 默认为 false ，默认不记录渲染性能。 mark 是浏览器 window.performance.mark 函数
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // TODO:
    // 避免被观察？vue 实例上的数据变动不要被响应式系统监听？
    // 在 vue 实例上挂载一个 _isVue 属性并且值是 true, 表示这是一个 vue 实例
    vm._isVue = true
    // merge options
    // options 是初始化 Vue 的传参，但是并没有传 _isComponent 找个值， 这个属性是一个内部选项，具体后面在进行介绍
    // _isComponent true 表示它是一个组件
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // TODO::
      // 优化内部组件实例化， 初始化内部函数
      // 因为动态 options 合并非常缓慢，并且内部组件 options 都不需要特殊处理
      // 这个函数的作用是将 额外的 options 参数扩展到 vm的 options 中去， 相同的引用值 vm.$options
      initInternalComponent(vm, options)
    } else {
      // 通常情况下都是走这里的逻辑，因为一般初始化 Vue 不会传 _isComponent

      // 传递给 mergeOptions 的三个参数：
      // 1. 通过 resolveConstructorOptions 函数得到，字面意思是“从构造函数中 resolve （分离，这个翻译总感觉怪怪的）出选项值”
      // 2. options 当前的选项
      // 3. vm 当前的 vue 实例
      // 在 vue 实例上添加了一个 $options 属性， 在 Vue 的官方文档中有关于对 $options 的介绍，这个属性用于当前 Vue 实例的初始化，
      // 而实际初始化 Vue 是下面 initXXX 这些函数做的事情，vm.$options 也是在那些函数中被调用的
      // mergeOptions 简单可以理解为会返回最终初始化 Vue 的时候的参数， 最终的返回结果是经过合并的 options
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), // 根 Vue 实例，在这函数执行之后 return 的值是 Vue.options
        options || {}, // 根 Vue 实例的 options: 类似这样的对象，在 main.js 中 { el: '#app', data: { test: 1 } }
        vm
      )

      // vm.$options 的作用在官网说明是用来添加一些自定义属性。添加自定义属性，由于在 mergeOptions 的时候没有合并的策略函数，所以会直接使用 defaultStrat
      // 也就是初始化的值是什么，得到的就是什么。

      // TODO: 
      // vm.constructor 在这里例子中值是 Vue 的构造函数，但是 Vue.extend() 获取到的 class new 出来的实例 constructor 就不是 Vue 函数，这里之后再看
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 作用之一是： 其实就是在实例对象 `vm` 上添加 `_renderProxy` 属性
      initProxy(vm)
    } else {
      // circular structure
      // 循环引用对象本来没有什么问题，序列化的时候才会发生问题
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    // 仅仅是在 vm 挂载一些与生命钩子函数相关的属性
    initLifecycle(vm)
    // vm 实例添加 _events 属性， 初始化好四个实例函数（事件）所需的条件 ？
    initEvents(vm)
    // 初始化渲染函数（在 vm 实例上挂载跟渲染相关的属性，比如 $slots $vnode $$attrs $listeners等）
    initRender(vm)
    // 触发 beforeCreate 钩子函数。也就是说上面的事情都是在 beforeCreate 之前处理的
    // beforeCreate 的钩子函数中就不能获取到 props、data 中定义的值，也不能调用 methods 中定义的函数。
    callHook(vm, 'beforeCreate')
    // TODO: 
    // provide 和 inject 主要为高阶插件/组件库提供用例
    initInjections(vm) // resolve injections before data/props
    // 初始化 props methods data computed watch  ;代理 data 上的属性到 this 上去
    initState(vm)
    // TODO: 
    initProvide(vm) // resolve provide after data/props
    // 调用 created 钩子函数
    callHook(vm, 'created')

    // 在 beforeCreate 和 created 的钩子调用的时候，并没有渲染 DOM，所以我们也不能够访问 DOM。
    // 一般来说，如果组件在加载的时候需要和后端有交互，放在这俩个钩子函数执行都可以，如果是需要访问 props、data 等数据的话，就需要使用 created 钩子函数。

    // _init(options) 函数就是渲染组件初始化（不包括挂载的时间）的全部时间了
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      // 简单理解 formatComponentName 的作用是通过一定的格式化方式返回了一个 name，会避免所有 vue 实例的 _name 重复
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      // 计算渲染的性能 
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 如果参数中传了 el 参数（一般只有在根实例初始化时才会传 el 参数用于指定挂载的 vdom 的位置），就执行 vm 的 $mount 
    if (vm.$options.el) {
      // TODO: $mount 函数是经过重写的，根据不同平台有不同的特性
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent(vm, options) {
  // 为什么要 Object.create(...) 创建一个以 vm.constructor.options 为原型的对象 ？
  // opts 访问 vm.constructor.options 中的对象是访问的到的，导师 Object.keys() 将会是空的数组
  const opts = vm.$options = Object.create(vm.constructor.options)
  // 这样做是因为它比动态枚举更快。
  // doing this because it's faster than dynamic enumeration.
  // TODO:
  // 这里为什么不直接赋值，而要 声明一个 parentVnode 再赋值？
  const parentVnode = options._parentVnode

  // TODO:: 
  opts.parent = options.parent
  // 之后会通过将这个 _parentVnode 赋值给 vm.$vnode 
  opts._parentVnode = parentVnode

  // TODO:
  // 这里为什么不直接赋值，而要 声明一个 parentVnode 再赋值？
  // 这里使用对象的结构会非常方便
  const vnodeComponentOptions = parentVnode.componentOptions
  // TODO:: 
  opts.propsData = vnodeComponentOptions.propsData
  // TODO:: 
  opts._parentListeners = vnodeComponentOptions.listeners
  // TODO:: 
  opts._renderChildren = vnodeComponentOptions.children
  // TODO:: 
  opts._componentTag = vnodeComponentOptions.tag

  // TODO:: 
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// 从函数的名称看， 这个函数的作用是 对外 resolve 参数（一个构造函数） 的 options
export function resolveConstructorOptions(Ctor) {
  // core/global-api/index.js
  // Vue.options = { components: { KeepAlive }, directives: Object.create(null), filters: Object.create(null), _base: Vue }
  let options = Ctor.options
  // 组件的 super 函数，`Ctor.super`，`super` 这是子类才有的属性, `super` 这个属性是与 `Vue.extend` 有关系的
  if (Ctor.super) {
    // 递归调用，这里需要获取根 Vue 实例初始化的时候的 options
    const superOptions = resolveConstructorOptions(Ctor.super)
    // TODO:
    // 组件实例本身是有 superOptions 这个属性的 ？
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // TODO:
      // 父类的参数为什么改变了？
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

function resolveModifiedOptions(Ctor) {
  let modified
  // TODO:
  // 实际 Ctor 的值是 Vue （一个实例）的构造函数 vm.constructor
  // constructor 函数为什么会有这么多的 options 参数？
  // options
  // extendOptions
  // sealedOptions
  const latest = Ctor.options
  // TODO:
  const extended = Ctor.extendOptions
  // TODO:
  // 封印的？ 受保护的？protected ？
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

// dedupe： 重复资料删除
function dedupe(latest, extended, sealed) {
  // TODO:
  // 确保在merge 参数的时候，生命周期函数不会重复执行
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    // TODO:
    // 如果 options 不是数组，怎么直接就 [ options ] 就完事了? 
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
    // TODO:
    // 为什么不是数组，直接return ？
    return latest
  }
}
