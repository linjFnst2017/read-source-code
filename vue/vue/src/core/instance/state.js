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
  // 将用来存储所有该组件实例的 `watcher` 对象
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
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
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
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
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
  // 通过上面的操作之后（mergeOptions 函数将用户输入的 data 变成一个函数，getData 函数从实例从又获取真实的 data）
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
  // observe data
  // 真正实现数据响应式的函数入口, 将 data 中的所有数据以递归的形式变成响应式的
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
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  // 计算属性只是SSR期间的getter
  const isSSR = isServerRendering()

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

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 为计算属性创建 内部 watcher
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 组件定义的计算属性已经在组件原型上定义。我们只需要定义在实例化时定义的计算属性。
    if (!(key in vm)) {
      // vm 实例上还没有 key 计算属性， 就挂载一个
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed(
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 是否应该缓存
  // TODO: 为啥需要通过 isServerRendering 是不是 ssr 来判断？
  const shouldCache = !isServerRendering()
  // 在 computed 中定义的 function 最终还是要处理成 set 和 getter 来处理的
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : userDef
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
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

function createComputedGetter(key) {
  return function computedGetter() {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
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

function initWatch(vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher(
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
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
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }
    return function unwatchFn() {
      watcher.teardown()
    }
  }
}
