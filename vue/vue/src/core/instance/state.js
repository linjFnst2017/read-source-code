/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy(target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter() {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter(val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}


export function initState(vm: Component) {
  // 将用来存储所有该组件实例的订阅者 watcher 对象
  vm._watchers = []
  const opts = vm.$options
  // 这里能够看出 created 生命钩子函数中 props methods 以及 data 中的数据是 props 先进行初始化，再是 data 最后才是 computed 和 watch
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    // `$data` 属性是一个访问器属性，其代理的值就是 `_data`
    // 如果组件参数 options 中不存在 data 对象，就 observe 一个空对象
    // asRootData: 代表将要被观测的数据是否是根级数据
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  // 由于 ff 浏览器的对象原生就带了一个 watch 对象（Object.prototype.watch），所以在判断 watch 的时候还需要判断一下 options.watch 对象是都是原生 watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

function initProps(vm: Component, propsOptions: Object) {
  // TODO: propsData ?
  // 最初的 props 初始化 Vue 实例的时候是在 props 属性上的， mergeOptions 后改名为 propsData ？
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 缓存 prop 的键，以便将来的 props 更新可以使用数组迭代，而不是动态对象键枚举 ？？
  // TODO: _propKeys ?
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  // 根实例 props 应该被转换
  if (!isRoot) {
    toggleObserving(false)
  }
  // propsOptions 经过处理，是一个对象了，值包含所有 prop 的类型等信息
  for (const key in propsOptions) {
    keys.push(key)
    // TODO: 
    // 暂时就理解为从 props 对象中获取 value 如果没有 value 的话就拿 default 或者在其他时机从 propsData 中获取值
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
        config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      // 将每一个  prop 定义成响应式的，并挂载在 _props 这个 key 上面
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 在Vue.extend()期间，组件的原型上已经代理了静态支柱。我们只需要代理在实例化时定义的 props
    // 将所有 props 的 key 都代理到 vm 实例上，后面就可以通过 this.xxx 来获取 this._props.xxx 了，这里的代理不同于上面的 defineReactive 将对象声明成响应式的。
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

// 实例对象代理访问数据 data
function initData(vm: Component) {
  // 挂载在 $options 上的属性是已经通过处理了的，vm.$options.data 最终被处理成一个函数，返回一个对象被 vue 观察
  let data = vm.$options.data
  // `beforeCreate` 声明周期钩子函数在 mergeOptions 函数执行之后，在 initData 函数执行之前， 虽然在 mergeOptions 函数执行之后 data 一定是一个函数
  // 但是如果 beforeCreate 钩子函数中修改了 vm.$options.data 的话，这里有必要再进行判断是否是一个 function
  // 当一个组件被定义，data 必须声明为返回一个初始数据对象的函数，因为组件可能被用来创建多个实例。如果 data 仍然是一个纯粹的对象，则所有的实例将共享引用同一个数据对象
  // 通过提供 data 函数，每次创建一个新实例后，我们能够调用 data 函数，从而返回初始数据的一个全新副本数据对象
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // TODO: 我不记得 mergeOptions  操作了 data
  // 通过上面的操作之后（mergeOptions 函数将用户输入的 data 变成一个函数，getData 函数从实例从又获取真实的 data） ？？？ 
  // 理论上说最后的结果应该是一个简单的对象了，但是如果有意外的话，在生产环境下需要报错， 比如用户的 data 函数 return 的是一个字符串之类的
  if (!isPlainObject(data)) {
    data = {}
    // data must be a function
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }

  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length

  while (i--) {
    const key = keys[i]
    // 声明属性的优先级： props优先级 > methods优先级 > data优先级
    if (process.env.NODE_ENV !== 'production') {
      // hasOwn: Object​.prototype​.has​OwnProperty 检测 methods 中是否有跟 data 中同名属性，非生产环境下报错
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 检测 key 是否是保留键， 不能以 $ 和 _ 开头。 
      // 通过 `Object.defineProperty` 函数在实例对象 `vm` 上定义与 `data` 数据字段同名的访问器属性，
      // 并且这些属性代理的值是`vm._data` 上对应属性的值. 简单说就是把 this._data.xx 上的值代理到 this 上去.
      proxy(vm, `_data`, key)
    }
  }
  // observe data data 对象上会添加一个 __ob__ 属性
  // 真正实现数据响应式的函数入口, 将 data 中的所有数据以递归的形式变成响应式的。 
  // observe 方法的作用就是给非 VNode 的对象类型数据添加一个 Observer
  // Observer 是一个类，它的作用是给对象的属性添加 getter 和 setter，用于依赖收集和派发更新 （或者说监听数据变化的）
  observe(data, true /* asRootData */)
}

// 函数名和参数中了解这个函数的作用是： 从一个 vue 实例中获取到它的 data
export function getData(data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  // 这里调用 pushTarget 和 popTarget 是为了防止通过 props 数据初始化 data 的时候收集冗余的依赖（观察者）
  // 将 Dep.target 值置为空的。 因为 data 函数执行的时候不希望被依赖收集
  pushTarget()
  try {
    // 第一个 this 指定作用域 等二个 this 是 data 函数的参数。 最终返回一个全新副本数据对象
    return data.call(vm, vm)
  } catch (e) {
    // 如果发生错误就直接返回一个空对象
    handleError(e, vm, `data()`)
    return {}
  } finally {
    // 重新置为原来的 Dep.target
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

// 计算属性挂载
function initComputed(vm: Component, computed: Object) {
  // $flow-disable-line
  // 
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  // 计算属性只是 SSR 期间的 getter。 返回是否是 ssr 
  const isSSR = isServerRendering()

  // 遍历获取到每一个 userDef
  for (const key in computed) {
    const userDef = computed[key]
    // userDef.get 这样的形式是通过在 computed 中定义一个包含 set 和 get 的对象来处理的
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    // 不是 ssr 的话，需要存储计算属性
    if (!isSSR) {
      // create internal watcher for the computed property.
      // 为计算属性创建 内部 watcher。 只要 getter 中依赖的值（比如说 data 中的某一个属性）发生了变化， 就会重新执行 getter 从而更新 watchers 的属性
      // new Watcher 传的参数的作用简单说明：
      // vm 是为了将该订阅者挂载到 vm 实例上面；第二个参数 getter 一般是一个表达式，在 getter 中使用到的 value （其实就是 vm 的 data 或者 props 或者 computed 中的被观察过的值呗）
      // 变化时，重新执行以下表达式；第三个参数简单理解为 watcher 的钩子函数（但是不确切，比如 before 之类的函数）；第四个参数是定义 wachter 的属性；
      // 第五个参数 bool 标注是否是跟 render 相关的 watcher， 如果是的话，还会在 vm._watcher 赋值当前这个 watcher
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
      // 为每一个 getter 创建一个 watcher，这个 watcher 和渲染 watcher 有一点很大的不同，它是一个 computed watcher，
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 组件定义的计算属性已经在组件原型上定义。我们只需要定义在实例化时定义的计算属性。
    if (!(key in vm)) {
      // vm 实例上还没有 key 计算属性， 就挂载一个。计算属性是直接挂载在 vm 实例上面的，跟 data 不一样不是通过代理的形式。props 上的值是先响应式挂载到了 vm._props 上，再通过 proxy 代理到 vm 上。
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // 判断 key 被 data 还是 props 占用并在非生产环境下发出警告
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

// 计算属性，有缓存的，依赖变化了才会重新进行计算
export function defineComputed(
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 是否应该缓存。 服务端渲染不需要。是否是因为服务端计算速度很快，无所谓 ?
  const shouldCache = !isServerRendering()
  // 在 computed 中定义的 function 最终还是要处理成 set 和 getter 来处理的
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key) // 从缓存中读取数据
      : userDef // 重新计算属性
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      // TODO:  userDef.cache ?
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  if (process.env.NODE_ENV !== 'production' &&
    sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// web 平台，shouldCache === true 需要缓存。
function createComputedGetter(key) {
  // computedGetter 函数是赋值到 get 函数上去的，就是计算属性对应的 getter。 也就是 target 来进行调用的，this 指向 target， 也就是当前的 vm 实例
  return function computedGetter() {
    // vm._computedWatchers[key] 每一个计算属性的都拥有一个订阅者（毕竟每一个属性都是一个表达式，常常需要重新计算的）
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // 对于计算属性 lazy = true 在 new Watcher 的构造函数中不会去执行 this.get() 来计算 value 值，而是在
      // 最开始的时候， watcher.dirty === watcher.lazy ，需要注意的是，计算属性的 lazy 都是 true
      if (watcher.dirty) {
        // 但是如果调用过 watcher.evaluate() 函数之后 dirty = false
        // 执行到 this.get() 函数的时候会将 this 赋值给 Dep.target, this 也就是这个 watcher. 并且接下来会继续执行 this.getter 函数
        // 如果计算属性的表达式中有 this.data.xx 类似的值，触发 data 属性的 get 函数，属性将自身 Object.defineProperty 函数闭包中的 dep 依赖添加到当前的 watcher 中，完成依赖收集。
        // 仔细想想有没有道理？ 每一个响应式的对象 Object.defineProperty 函数闭包中的 dep 需要被每一个订阅者都储存，这样
        watcher.evaluate()
      }
      // watcher.evaluate() 会执行 watcher.get() 也就是执行以下 new watcher 传入的表达式来收集依赖。
      // 如果在 render 函数中使用了计算属性，那么此时的 target 值是渲染订阅者 watcher（即这个订阅者的表达式是 updateComponent 函数，跟视图渲染有管的）
      // 那么就收集依赖；
      // Dep.target 的值 computed watcher. 是一个计算属性依赖的值变化的时候，重新计算计算属性并缓存的订阅者。
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

// 为 vm 实例挂载 methods 对象中定义的方法
function initMethods(vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 提醒 props 中有同名的属性， 也体现 props 的优先级更高
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 与 vm 实例一些内置属性冲突
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 不含值的键，定义为空函数
    // 自动为函数指定 this. 注意这里的方法是直接挂载在 vm 实例上的，而不是跟 data 一样通过代理的形式
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
  }
}

// 侦听属性的初始化
function initWatch(vm: Component, watch: Object) {
  for (const key in watch) {
    // watch 对象中的处理器，可以是函数，也可以是一个对象
    const handler = watch[key]
    //  Vue 是支持 watch 的同一个 key 对应多个 handler
    // 判断为数组的是为了 mixin watch 的场景，当然其实开发者自定义成数组的形式也是可以顺序执行处理函数的。
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

// 创建订阅者
function createWatcher(
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 普通对象需要包含 handler 函数
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 如果是一个字符串的话，是调用 vm 上的函数的缩写。
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin(Vue) {
  // 在使用 Object.defineProperty 时，flow在直接声明定义对象方面存在一些问题，因此我们必须在这里以程序的方式构建对象
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.

  // data descriptor function set 和 get 函数
  const dataDef = {}
  // $data 属性实际上代理的是 _data 这个实例属性
  dataDef.get = function () { return this._data }
  const propsDef = {}
  // $props 代理的是 _props 这个实例属性
  propsDef.get = function () { return this._props }
  // 也就是说，$data 和 $props 是两个只读的属性，所以，现在让你使用 js 实现一个只读的属性，你应该知道要怎么做了。
  if (process.env.NODE_ENV !== 'production') {
    // newData 是一个对象
    dataDef.set = function (newData) {
      // 避免替换实例根$data。而是使用嵌套数据属性。
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    // $props 对象是只读的
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }

  // Object.defineProperty(obj,prop,descriptor), 方法会直接在一个对象上定义一个新属性，或者修改一个已经存在的属性， 并返回这个对象。
  // descriptor 必须为一个包含 set / get 函数的一个对象， 也就是 dataDef， propsDef
  // 在Vue 原型链上定义完 $data 和 $props 之后，data 和 props 就会变成响应式了
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  // 实例方法
  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // 侦听属性
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any, // handler 处理函数
    options?: Object
  ): Function {
    const vm: Component = this
    // 这里之所以要这么写是因为 $watch 这个 api 可以被开发者自行调用， cb 可以传函数也可以穿对象（需要包含 handler 函数），
    // 如果是一个对象的话，就调用 createWatcher 函数，主要是处理一下 cb 的形式转化成函数形式， 最终还是返回来调用  $watch 
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    // 用户自定义的侦听属性
    options.user = true
    // 创建一个订阅者，表达式（string 为多， 通过 this.[expOrFn] 这样的形式来获取）触发 get 函数（我理解只能监听 data props 以及 computed 中的属性）
    // 有依赖改变的话，就执行 cb 回调
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // immediate 立即执行。
    if (options.immediate) {
      // 不等依赖改变的时候就立即执行回调
      cb.call(vm, watcher.value)
    }
    // 返回的
    return function unwatchFn() {
      // 删除当前订阅者的依赖信息。包括两个步骤： 
      // 1. 删除声明当前订阅者的 vm 实例中的订阅者队列中的自身。 
      // 2. 遍历自身依赖队列 deps 中每一个 dep 的订阅者队列，删除自身这个订阅者，意思是以后那个表达式中依赖的数据改变了之后不需要通知我了。
      watcher.teardown()
    }
  }
}
