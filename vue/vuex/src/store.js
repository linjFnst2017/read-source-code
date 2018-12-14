// 这个函数的作用主要是针对不同版本的 vue 声明好 vuex 的初始化函数
// 针对 vue@2.x 可以直接通过 Vue.mixin 这个 API 添加 Vue 的全局配置（会影响之后所有的 Vue Instance），添加了一个 beforeCreate 的声明周期函数
// 针对 vue@1.x ，它的初始化函数 _init 挂载在 Vue 的原型链， vue@1.x 初始化估计是执行 this._init() 
// todo: 这里存在的一个问题是 Vue.mixin 这个 API 对于重名的声明周期函数是怎么兼容的？ 如果其中一个 Vue 实例已经声明过 beforeCreate 声明周期函数了呢？
import applyMixin from './mixin'
// vuex 默认加载插件
// todo: 最好是能够使用 devtoolPlugin 的概念来写一个时间旅行的可视化执行器
import devtoolPlugin from './plugins/devtool'
// 根据 new Store() 初始化实例的时候传入的参数 options，初始化每一个 module 的（内置）属性，构件好模块之间的依赖关系， 最后直接赋值给 root module
import ModuleCollection from './module/module-collection'
import { forEachValue, isObject, isPromise, assert } from './util'

// 在安装时绑定
let Vue

export class Store {
  constructor(options = {}) {
    // Auto install if it is not done yet and `window` has `Vue`.
    // To allow users to avoid auto-installation in some cases,
    // this code should be placed here. See #731
    // 允许用户在某些情况下避免自动安装， 这段代码应该放在这里
    // todo: 没明白这个条件是什么意思？ !Vue ？是上面声明的 Vue 么？
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue)
    }

    // note: 在产品模式下抛出错误其实是没什么意义的，用户通常不会去看报错。
    // assert 如果第一个参数不存在 (undefined) 或者 false， 就主动抛出 Error 
    if (process.env.NODE_ENV !== 'production') {
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      assert(this instanceof Store, `store must be called with the new operator.`)
    }

    // note: 结构 options， modules, getters, mutations 等
    // TODO:: 不过 options 中的 modules 这里怎么没有使用？
    const {
      plugins = [],
      strict = false // 默认不是严格模式（只能通过 mutation 来修改 state 的值）
    } = options

    // store 内部的属性，都命名为 _xxx 估计是为了不跟开发者的声明的变量会冲突
    // store internal state
    this._committing = false // 是否当前正在 commit mutation
    // toString,hasOwnProperty 等这些 Object 上的属性，Vue 都重新拷贝了一份，貌似这里是不想要？
    this._actions = Object.create(null) // todo: 为啥？ 创建的空对象原型链上层是空的了，https://segmentfault.com/q/1010000009976954
    this._actionSubscribers = [] // 对象不需要上层的原型链了，为什么数组这里还需要？
    this._mutations = Object.create(null)
    this._wrappedGetters = Object.create(null)
    // 将 new Store() 时的参数传入， 加工 module， 为每一个 module 添加 _children runtime state _rawModule 这几个属性
    this._modules = new ModuleCollection(options)
    // 挂载模块的一个 对象
    this._modulesNamespaceMap = Object.create(null)
    // mutation 订阅者， 监听每次有 mutation 改变就执行
    this._subscribers = []
    // todo: 用来监听 ？
    this._watcherVM = new Vue()

    // bind commit and dispatch to self

    // 为什么这里不直接通过 dispatch.call(this, xx,yy) ？ 感觉是为了语义上更通顺
    // 这种函数赋值，为什么还要还要声明一个函数名？ 或者为什么不直接使用箭头函数

    const store = this
    const { dispatch, commit } = this

    // 这里的 this 是 vuex 类的一个实例， 所以上面的所有属性和这里的 dispatch 和 commit 都是挂载在 this 实例上的
    // const { dispatch, commit } = this 这里的 dispatch 和 commit 则是挂载在 vuex 的原型上的
    this.dispatch = function boundDispatch(type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit(type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    this.strict = strict

    // 加工过的 _modules, 有对应的 modules 的父子关系，
    // todo: _modules 对应的具体值，还需要看一下
    const state = this._modules.root.state

    // init root module.
    // this also recursively registers all sub-modules
    // and collects all module getters inside this._wrappedGetters
    // 这也递归地注册所有子模块和 this._wrappedGetters中所有模块getter 的 collects 
    // todo: collects ？
    installModule(this, state, [], this._modules.root)

    // initialize the store vm, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    // 初始化 store vm， 能够对视图进行响应， 同时也注册了 _wrappedGetters 作为一个计算属性
    resetStoreVM(this, state)

    // apply plugins
    // plugins 的值是通过 options 传入的， 
    // todo:  plugin 插件名就是一个函数 ？
    plugins.forEach(plugin => plugin(this))

    if (Vue.config.devtools) {
      devtoolPlugin(this)
    }
  }

  get state() {
    // _vm 的内容是 data: $$state 以及 computed , 据作者的说法这里会将 module 的 getter 都会使用 Vue 的 computed 来做缓存
    return this._vm._data.$$state
  }

  set state(v) {
    // state 不允许直接被修改， this.$store.state = xxx 的时候 set 函数会被调用
    if (process.env.NODE_ENV !== 'production') {
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }

  commit(_type, _payload, _options) {
    // check object-style commit
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }

    const entry = this._mutations[type]
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    // 将 store 的状态置为 isCommiting
    this._withCommit(() => {
      // 依次执行名为 type 的 mutation
      entry.forEach(function commitIterator(handler) {
        handler(payload)
      })
    })
    // 订阅的 mutation 触发回调事件，数组中的内容是一个一个的回调函数，依次触发
    this._subscribers.forEach(sub => sub(mutation, this.state))

    if (
      process.env.NODE_ENV !== 'production' &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  dispatch(_type, _payload) {
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    // 注册 action 的时候挂载的（异步）函数
    const entry = this._actions[type]
    // 如果 dipatch 了一个没有找到的 action 的话，就
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }
    // 订阅的 action 触发回调事件，数组中的内容是一个一个的回调函数，依次触发
    this._actionSubscribers.forEach(sub => sub(action, this.state))

    return entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)
  }

  // 从字面上看就是每一个 mutation 触发时执行注册的回调， 用于 devtool 以及 logger 等插件实现 time travel
  subscribe(fn) {
    return genericSubscribe(fn, this._subscribers)
  }

  // 貌似没用用到 store.subscribeAction(), 从字面上看就是每一个 action 触发时执行注册的回调
  subscribeAction(fn) {
    return genericSubscribe(fn, this._actionSubscribers)
  }

  watch(getter, cb, options) {
    if (process.env.NODE_ENV !== 'production') {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    // 调用 vue 实例的 $watch 函数
    return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
  }

  // 直接替换新的 state 
  replaceState(state) {
    this._withCommit(() => {
      this._vm._data.$$state = state
    })
  }

  registerModule(path, rawModule, options = {}) {
    if (typeof path === 'string') path = [path]

    if (process.env.NODE_ENV !== 'production') {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    this._modules.register(path, rawModule)
    installModule(this, this.state, path, this._modules.get(path), options.preserveState)
    // reset store to update getters...
    resetStoreVM(this, this.state)
  }

  unregisterModule(path) {
    if (typeof path === 'string') path = [path]

    if (process.env.NODE_ENV !== 'production') {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }
    // 这里可以将 path 理解为一个 root module 开始表示父子关系的一个数组
    // 相当于这里 unregister(path) 的 path 是传了整个 path/to/module array
    // 但是在 unregister 函数里，会将从 path 获取当前的 moduleName， 并在满足一定条件的情况下 从 _children 中 delete moduleName
    this._modules.unregister(path)
    this._withCommit(() => {
      // 因为这里需要删除某一个指定的 module, 而这个指定的子模块是挂载在 它的父模块的 _children 上的，所以 delete 的前提是获取它的父模块
      const parentState = getNestedState(this.state, path.slice(0, -1))
      // 这里一开始很奇怪，为什么是这样去删除，应该通过 parentModule.removeChild 这样的方式
      // 删除对象的属性。如果对象是响应式的，确保删除能触发更新视图。这个方法主要用于避开 Vue 不能检测到属性被删除的限制，但是你应该很少会使用它
      // 删除某个指定的 state 值之后确保触发视图。
      // todo: 还是很奇怪，这里为什么不直接 removeChild， 理论上 removeChild 应该也有删除触发视图更新的回调才对
      Vue.delete(parentState, path[path.length - 1])
    })
    resetStore(this)
  }

  hotUpdate(newOptions) {
    this._modules.update(newOptions)
    resetStore(this, true)
  }

  // todo: 当前如果没有在 commiting 中的话，执行这个 fn 的意义在哪里？
  _withCommit(fn) {
    // todo: _committing === true 状态下会怎么样？ 我记得貌似是不能被打断？
    const committing = this._committing
    this._committing = true
    fn()
    this._committing = committing
  }
}

// 一般的订阅事件注册
function genericSubscribe(fn, subs) {
  if (subs.indexOf(fn) < 0) {
    subs.push(fn)
  }
  return () => {
    const i = subs.indexOf(fn)
    if (i > -1) {
      // todo: 为什么要改变原来的 subs 
      subs.splice(i, 1)
    }
  }
}

function resetStore(store, hot) {
  store._actions = Object.create(null)
  store._mutations = Object.create(null)
  store._wrappedGetters = Object.create(null)
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // init all modules
  installModule(store, state, [], store._modules.root, true)
  // reset vm
  resetStoreVM(store, state, hot)
}

function resetStoreVM(store, state, hot) {
  // todo: undefined 的情况到底是 rootModule ？ 还是每一个 module 都会挂载一个 _vm ?
  const oldVm = store._vm

  // bind store public getters
  store.getters = {}
  // 经过注册的 getters 都已经挂载到了 _wrappedGetters 上。
  // FIXME: 所以貌似注册大量的 getters 到 store 上确实应该不会太影响性能
  const wrappedGetters = store._wrappedGetters
  const computed = {}

  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    // 使用computed来利用其惰性缓存机制, 这里的 computed 最终是要挂载到 Vue.computed 上去的。
    computed[key] = () => fn(store)
    // todo: 很奇怪这里为什么需要在 vm 实例的 computed 上挂载之后，还需要在 store.getters 中也声明这个属性。
    // todo: 话说，如果仅仅使用 get 那 defineProperty 声明 与直接字面量挂载有什么区别？
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      // 此处设置为false， 在枚举的时候会忽略, for in 不会被获取到
      enumerable: true // for local getters 
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  // 在用户添加一些 funky 的全局 mixins 的情况下禁止警告
  const silent = Vue.config.silent
  // 用于取消 Vue 所有的日志与警告
  Vue.config.silent = true
  // todo: 这里为什么需要这样来挂载一个 _vm, 然后这么操作是因为 这里 new Vue 的时候会报错？
  // 一直念念不忘的 $$state ...
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  })
  Vue.config.silent = silent

  // enable strict mode for new vm
  if (store.strict) {
    enableStrictMode(store)
  }

  if (oldVm) {
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      // 在所有订阅的观察者中 发送更改 以强制重新评估热重新加载的getter。
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    // 将回调延迟到下次 DOM 更新循环之后执行
    Vue.nextTick(() => oldVm.$destroy())
  }
}

function installModule(store, rootState, path, module, hot) {
  // root 的 path 是 []
  // todo: 非 root 的 path 的 path 具体是什么值？
  const isRoot = !path.length
  // root 模块应该返回 '', 非 root 模块的话，这里应该就是拼接 namespace
  // getNamespace 函数里面的逻辑主要是判断 module 的 namespaced 是否开启
  const namespace = store._modules.getNamespace(path)

  // register in namespace map
  // 如果模块的 namespaced 开启就挂载到 _modulesNamespaceMap 上
  // todo: 理论上来说 namespaced 没有开启的话应该是都挂载到 root 上的 ？
  if (module.namespaced) {
    store._modulesNamespaceMap[namespace] = module
  }

  // set state
  // todo: hot 字段指的意义是？
  if (!isRoot && !hot) {
    // path/to/module 
    // todo: 看起来 getNestedState 函数获取的应该是子模块的 state ，但是这里被赋值的却是 parentState
    const parentState = getNestedState(rootState, path.slice(0, -1))
    // path 的最后一个值是当前的 moduleName
    const moduleName = path[path.length - 1]
    store._withCommit(() => {
      // 向响应式对象中添加一个属性，并确保这个新属性同样是响应式的，且触发视图更新。
      // 所以很多时候，通过接口异步获取的 resp 赋值给 state 之后，其中的数组或者对象直接被修改的情况下，是不会触发视图更新的
      // 必须要通过 mutation 来改变 state 才能触发视图更新，其原理就是在这里，state 中的那些对象不是响应式对象。
      Vue.set(parentState, moduleName, module.state)
    })
  }
  // todo: context 没有出现过啊
  const local = module.context = makeLocalContext(store, namespace, path)

  // todo: 这里为什么需要重写这几个函数啊
  // 貌似不是 重写？是调用了 module.forEachMutation 函数， 传了一个 cb 进来
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key
    registerMutation(store, namespacedType, mutation, local)
  })

  module.forEachAction((action, key) => {
    const type = action.root ? key : namespace + key
    const handler = action.handler || action
    registerAction(store, type, handler, local)
  })

  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key
    registerGetter(store, namespacedType, getter, local)
  })

  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
  })
}

/**
 * make localized dispatch, commit, getters and state
 * if there is no namespace, just use root ones
 */
function makeLocalContext(store, namespace, path) {
  const noNamespace = namespace === ''

  const local = {
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) {
        type = namespace + type
        if (process.env.NODE_ENV !== 'production' && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }

      return store.dispatch(type, payload)
    },

    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) {
        type = namespace + type
        if (process.env.NODE_ENV !== 'production' && !store._mutations[type]) {
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }

      store.commit(type, payload, options)
    }
  }

  // getters and state object must be gotten lazily
  // because they will be changed by vm update
  Object.defineProperties(local, {
    getters: {
      get: noNamespace
        ? () => store.getters
        : () => makeLocalGetters(store, namespace)
    },
    state: {
      get: () => getNestedState(store.state, path)
    }
  })

  return local
}

function makeLocalGetters(store, namespace) {
  const gettersProxy = {}

  const splitPos = namespace.length
  Object.keys(store.getters).forEach(type => {
    // skip if the target getter is not match this namespace
    if (type.slice(0, splitPos) !== namespace) return

    // extract local getter type
    const localType = type.slice(splitPos)

    // Add a port to the getters proxy.
    // Define as getter property because
    // we do not want to evaluate the getters in this time.
    Object.defineProperty(gettersProxy, localType, {
      get: () => store.getters[type],
      enumerable: true
    })
  })

  return gettersProxy
}

function registerMutation(store, type, handler, local) {
  // note: 这个写法很 ok 啊， 如果为 undefined 的话，直接赋值，而不是 return 一个默认值
  // 并且重要的一点是，这里的 entry 和 store._mutations[type] 指向的是同一个数组， 默认值的时候也是
  // todo: 所以这里直接拿 entry 操作，应该是为了更直观？
  const entry = store._mutations[type] || (store._mutations[type] = [])
  // todo: 某一个 key 声明多个 mutation 会怎么样？ 
  // 一般情况下 entry 都是一个包含一个元素的数组
  entry.push(function wrappedMutationHandler(payload) {
    handler.call(store, local.state, payload)
  })
}

function registerAction(store, type, handler, local) {
  const entry = store._actions[type] || (store._actions[type] = [])
  entry.push(function wrappedActionHandler(payload, cb) {
    // ation 其实有三个参数， storeAPI, payload, 以及 cb
    // todo: 很奇怪这里的 cb 没有进行调用
    let res = handler.call(store, {
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      // 子模块里面 额外的两个 root 部分
      rootGetters: store.getters,
      rootState: store.state
    }, payload, cb)
    if (!isPromise(res)) {
      // todo: 将普通函数封装成 promise 的方式？
      res = Promise.resolve(res)
    }
    // todo: 
    if (store._devtoolHook) {
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      return res
    }
  })
}

function registerGetter(store, type, rawGetter, local) {
  if (store._wrappedGetters[type]) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  // 可以理解为为 store._wrappedGetters 挂载上一个名为 type 的属性，值为一个参数是 local.xxx 的函数，函数是 rawGetter
  // rawGetter 应该理解为一个简单的箭头函数，类似于: username: state => state.userInfo.username
  // FIXME: 
  // todo: 这里有一个奇怪的问题，为什么这里 func 的参数不使用解构的形式，顺序参数，getters 里面应该会有问题吧
  store._wrappedGetters[type] = function wrappedGetter(store) {
    return rawGetter(
      local.state, // local state
      local.getters, // local getters
      store.state, // root state
      store.getters // root getters
    )
  }
}

function enableStrictMode(store) {
  // todo: store_vm 表示的值到底是啥？ 这里为啥又不用 Vue.$watch 了？
  // vm.$watch(a, b)
  // 第一个参数是是一个被 watch 的值，可以是字符串， 也可以是一个函数， 这里具体 $watch 实现的逻辑就要去 vue core 了
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (process.env.NODE_ENV !== 'production') {
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
    // https://cn.vuejs.org/v2/api/#vm-watch sync 这里与文档有出入了。
    // deep 深度监听
  }, { deep: true, sync: true })
}

// 根据 path 表示的层次，来获取嵌套的指定 module
function getNestedState(state, path) {
  return path.length
    // 例如 ['a', 'b', 'c'] 通过 reduce 函数，从 rootModule 中获取 rootModule[a][b][c] 并 return
    ? path.reduce((state, key) => state[key], state)
    : state
}

// unify 统一
function unifyObjectStyle(type, payload, options) {
  if (isObject(type) && type.type) {
    options = payload
    // payload 是一个包含 type 属性的对象
    payload = type
    type = type.type
  }

  if (process.env.NODE_ENV !== 'production') {
    assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`)
  }

  return { type, payload, options }
}

export function install(_Vue) {
  // 主要是调用这个 applyMixin 函数，另外 install 函数的作用，还有在开发环境下提示开发者不要多次调用 install 函数
  // 多次调用 install(Vue) 的作用是一样的，因为多次 import 的 Vue 实际上是同一个指向的，webpack 只会打包一次
  if (Vue && _Vue === Vue) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  // todo: 不过也许这里有 _Vue !== Vue 的考量, 之后再看
  Vue = _Vue
  // 这一步的操作内容是调用了 Vue.mixin ，为每一个之后创建的 Vue 实例都添加了一个 beforeCreate 钩子函数
  // 为每一个 Vue 实例都挂载了一个 this.$store 的属性，值为全局的 store
  applyMixin(Vue)
}
