/* @flow */
// 观察者
import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor(
    // 实例对象
    vm: Component,
    // 要观察的表达式 `expOrFn`
    expOrFn: string | Function,
    // 当被观察的表达式的值变化时的回调函数 `cb`， `noop` 是一个空函数
    cb: Function,
    // 第四个参数是一个包含 `before` 函数的对象
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    // 每一个观察者实例对象都有一个 `vm` 实例属性， 该属性指明了这个观察者是属于哪一个组件的
    this.vm = vm
    //  `isRenderWatcher` 标识着是否是渲染函数的观察者
    if (isRenderWatcher) {
      // 当前观察者实例赋值给 `vm._watcher` 属性， 组件实例的 `_watcher` 属性的值引用着该组件的渲染函数观察者
      vm._watcher = this
    }
    // 组件实例的 `vm._watchers` 属性是在 `initState` 函数中初始化的，其初始值是一个空数组, 存放订阅者实例
    // 将当前观察者实例对象 `push` 到 `vm._watchers` 数组中，也就是说属于该组件实例的观察者都会被添加到该组件实例对象的 `vm._watchers` 数组
    vm._watchers.push(this)
    // options
    if (options) {
      // 用来告诉当前观察者实例对象是否是深度观测
      this.deep = !!options.deep
      // 用来标识当前观察者实例对象是 **开发者定义的** 还是 **内部定义的**
      this.user = !!options.user
      // 用来告诉观察者当数据变化时是否同步求值并执行回调
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      // 可以理解为 `Watcher` 实例的钩子，当数据变化之后，触发更新之前，调用在创建渲染函数的观察者实例对象时传递的 `before` 选项
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    // 观察者实例对象的唯一标识
    this.id = ++uid // uid for batching
    // 标识着该观察者实例对象是否是激活状态
    this.active = true
    this.dirty = this.lazy // for lazy watchers

    // 用来实现避免收集重复依赖，移除无用依赖的功能
    this.deps = []
    this.newDeps = []
    // 用来实现避免收集重复依赖，移除无用依赖的功能
    this.depIds = new Set()
    this.newDepIds = new Set()

    // 该属性的值为表达式(`expOrFn`)的字符串表示
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // TODO: 看起来这里的场景应该是适用于 this.$watch 函数来监听的情况
      // 通过 path =》 string 表达式来获取 this 中的值， `this.getter` 函数终将会是一个函数
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () { }
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }

    this.value = this.lazy
      ? undefined
      // `this.value` 属性保存着被观察目标的值， 也就是初始化的时候，除非是指定了 lazy 属性，否则的话，初始化 Watcher 实例成功之后， this.value 储存着被观察的值
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  // 获得getter的值, 并且重新进行依赖收集
  // 求值， 求值的目的有两个，第一个是能够触发访问器属性的 `get` 拦截器函数，第二个是能够获得被观察目标的值。
  get() {
    //  `Dep` 类拥有一个静态属性，即 `Dep.target` 属性，该属性的初始值为 `null`，其实 `pushTarget` 函数的作用就是用来为 `Dep.target` 属性赋值的，
    // `pushTarget` 函数会将接收到的参数赋值给`Dep.target` 属性， `Dep.target` 保存着一个观察者对象，其实这个观察者对象就是即将要收集的目标
    // 将自身 watcher 实例设置给 Dep.target，用以依赖收集。
    pushTarget(this)
    let value
    const vm = this.vm
    // 通过将 Dep.target 设置为当前的 watcher 实例之后，尝试执行了 getter 函数。
    // 所有被观察的值，比如 this._data_test 在被 Object.defineProperty 定义的 getter 函数中收集了依赖。
    // getter 函数被定义在 observer/index.js 中的 defineReactive 函数中, 每一次调用 defineReactive 函数都会（闭包中）创建一个 Dep 实例
    // 通过获取 Dep.target 的值 push 到 Dep 实例中的 subs 数组中，而这个 Dep 实例在 getter 执行完了之后依然存在，还需要在 setter 函数中被 notify
    try {
      // 这个函数的执行就意味着对被观察目标的求值， 对被观察目标的求值才得以触发数据属性的 `get` 拦截器函数
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 如果存在deep，则触发每个深层对象的依赖，追踪其变化
      if (this.deep) {
        // 递归每一个对象或者数组，触发它们的getter，使得对象或数组的每一个成员都被依赖收集，形成一个“深（deep）”依赖关系
        traverse(value)
      }
      // 清空当前这个临时存储的表达式（其实是 render 函数）
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   * 添加一个依赖关系到Deps集合中
   */
  addDep(dep: Dep) {
    // dep.id 每一个依赖的唯一 id
    const id = dep.id
    // 避免重复收集依赖， 先根据 `dep.id` 属性检测该 `Dep` 实例对象是否已经存在于 `newDepIds` 中，如果存在那么说明已经收集过依赖了，什么都不会做
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps() {
    // 移除所有观察者对象
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * 当依赖项发生更改时，将调用订阅者接口
   */
  update() {
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      // 同步则执行run直接渲染视图
      this.run()
    } else {
      // 异步推送到观察者队列中，由调度者调用。
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   * 调度者工作接口，将被调度者回调。
   */
  run() {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        // 即便值相同，拥有Deep属性的观察者以及在对象／数组上的观察者应该被触发更新，因为它们的值可能发生改变。
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        // 设置新的值
        this.value = value
        // 触发回调渲染视图
        if (this.user) {
          // 用户自定义的 watcher 
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          // 系统定义的 watcher cb 一般是 vm 的 render 函数
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   * 获取观察者的值
   */
  evaluate() {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   * 收集该watcher的所有deps依赖
   */
  depend() {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   * 将自身从所有依赖收集订阅列表删除
   */
  teardown() {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      // 从vm实例的观察者列表中将自身移除，由于该操作比较耗费资源，所以如果vm实例正在被销毁则跳过该步骤。
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
