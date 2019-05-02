/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'

import {
  warn,
  noop,
  remove,
  handleError,
  emptyObject,
  validateProp
} from '../util/index'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

// 在 vm 实例上挂载 $parent ，指定父子组件的关系，并且挂载了一些跟 Vue 生命周期相关的属性
export function initLifecycle(vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  // 定义 parent，它引用当前实例的父实例
  let parent = options.parent
  // 如果当前实例有父组件，且当前实例不是抽象的
  // 将当前实例添加到父实例的 `$children` 属性里，并设置当前实例的 `$parent` 指向父实例
  if (parent && !options.abstract) {
    // 使用 while 循环查找第一个非抽象的父组件。 抽象组件，例如 keep-alive 等内置组件，是不需要进行渲染的，在父子容器之间的关系上也不用体现。即不需要将某一个子组件放入一个抽象父组件的 children 中。
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    // 经过上面的 while 循环后，parent 应该是一个非抽象的组件，将它作为当前实例的父级，所以将当前实例 vm 添加到父级的 $children 属性里
    parent.$children.push(vm)
  }

  // 设置当前实例的 $parent 属性，指向父级
  // `vm.$parent` 就是用来保留当前 `vm` 的父实例，并且通过 `parent.$children.push(vm)` 来把当前的 `vm` 存储到父实例的 `$children` 中
  // 简单说就是保持上下文的作用
  vm.$parent = parent
  // 设置 $root 属性，有父级就是用父级的 $root，否则 $root 指向自身
  vm.$root = parent ? parent.$root : vm

  // 孩子容器里面装的是一个个 vue 实例
  vm.$children = []
  vm.$refs = {}

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

// 生命周期函数的声明，直接在原型链上挂载相关的方法
export function lifecycleMixin(Vue: Class<Component>) {
  // _update 是 Vue 实例的私有方法，调用的时机有两个，一个是首次渲染，一个是数据更新的时候。`_update` 方法的作用是把 VNode 渲染成真实的 DOM
  // 更新， Vue 的响应式原理中，set 函数触发重新渲染就是用的 _update 函数
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    // $el 是获取之前（当前）渲染的 dom 节点和 _vnode 节点 （也就是一个真实的节点，一个虚拟节点）
    // $el 在执行这个函数的时候应该是 undefined 吧， 后来在 mountComponent 函数中 $el 被赋值为 el 挂载的节点
    const prevEl = vm.$el
    // 是还没更新 dom 对应的 vnode， 也就是旧的 vnode 节点，接下来需要跟传参 vnode 进行 diff 之后才能 patch
    const prevVnode = vm._vnode
    // 这个 `activeInstance` 作用就是保持当前上下文的 Vue 实例，它是在 `lifecycle` 模块的全局变量
    // 当前的 `vm` 赋值给 `activeInstance`，同时通过 `const prevActiveInstance = activeInstance` 用 `prevActiveInstance` 保留上一次的 `activeInstance`
    // 实际上，`prevActiveInstance` 和当前的 `vm` 是一个父子关系
    // 当一个 `vm` 实例完成它的所有子树的 patch 或者 update 过程后，`activeInstance` 会回到它的父实例，
    // 这样就完美地保证了`createComponentInstanceForVnode` 整个深度遍历过程中，我们在实例化子组件的时候能传入当前子组件的父 Vue 实例，
    // 并在`_init` 的过程中，通过`vm.$parent` 把这个父子关系保留。
    const prevActiveInstance = activeInstance
    // 当前激活的实例
    activeInstance = vm
    // _vnode 保存 dom 对应的虚拟节点，这里需要更新为新的 vnode 对应的 dom ，所以 _vnode 也需要更新
    // 这个 `vnode` 是通过 `vm._render()` 返回的组件渲染 VNode, vm._vnode` 和 `vm.$vnode` 的关系就是一种父子关系
    // 用代码表达就是 `vm._vnode.parent === vm.$vnode`
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // Vue.prototype.__patch__ 函数在 render 函数执行之后每一个实例上都被注入了。 
    // `_update` 的核心就是调用 `vm.__patch__` 方法。这个方法实际上在不同的平台，比如 web 和 weex 上的定义是不一样的。
    if (!prevVnode) {
      // initial render 首次渲染
      //  `vm.__patch__` 函数的返回值是一个真实的 dom 节点。
      // （如果上一个 vnode 节点不存在的话）初次渲染，就直接调用 __patch__ 
      // `vm.$el` 对应的是例子中 id 为 `app` 的 DOM 对象 <div id="app">
      // `vnode` 对应的是调用 `render` 函数的返回值
      // `hydrating` 在非服务端渲染情况下为 false，`removeOnly` 为 false
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // updates
      //  `vm.__patch__` 函数的返回值重写， 这里应该需要将新旧 vnode 节点都传入 __patch__ 函数中进行比对之后得出最小的变化，最后更新到 dom 上
      // 当然了再更新到 dom 之前，是将 dom 节点的值保存在 vm.$el 中的
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    // TODO: 
    activeInstance = prevActiveInstance
    // update __vue__ reference
    // 更新 __vue__ 指向
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  // 强制更新 dom
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    // 通过监听器直接视图更新，关键在于 _watcher 这里是负责通知到视图进行更新的
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  // 销毁钩子函数
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    // _isBeingDestroyed 已经正在被销毁中 ？
    if (vm._isBeingDestroyed) {
      return
    }
    // 触发定义的 beforeDestroy 钩子函数
    // beforeDestroy 钩子函数的执行时机是在 $destroy 函数执行最开始的地方，接着执行了一系列的销毁动作
    callHook(vm, 'beforeDestroy')
    // 标志位
    vm._isBeingDestroyed = true
    // remove self from parent
    // 从父节点中移除自身
    const parent = vm.$parent
    // 父节点此时没有正在被销毁， 并且父节点也不能是抽象组件。 事实上这里如果是抽象组件的话，不能从父节点中移除 ？？？
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      // 从父节点的 $children 数组中将当前节点移除，删掉自身
      remove(parent.$children, vm)
    }
    // teardown watchers
    // 拆卸 watcher。 因为组件被销毁了，依赖监听可以不用执行了，下一次如果节点再被加载的话，依赖收集的操作应该在挂载之前 ？？？
    if (vm._watcher) {
      // 将 vm._watcher 从 vm._watchers 数组中删除
      vm._watcher.teardown()
    }
    let i = vm._watchers.length
    // 全部订阅者都拆卸调
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
    // 移除 data 对象上的观察属性 __ob__
    if (vm._data.__ob__) {
      // 被观察的 vm 个数减少一个
      vm._data.__ob__.vmCount--
    }
    // call the last hook...
    // 标志为已删除
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree
    // 在真实 dom 上移除。通过 patch 函数一般至少需要传两个参数，旧的 vnode 节点和新的 vnode 节点。 
    // 这里第二个参数是就是新的 vnode 节点，值为 null 表示没有新的 vnode 节点了也就是不需要渲染 dom 了，即从 dom 中删除
    // vm.__patch__(vm._vnode, null) 触发它子组件的销毁钩子函数，这样一层层的递归调用，所以 destroy 钩子函数执行顺序是先子后父，和 mounted 过程一样
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook
    // 触发用户定义的 destroyed 钩子函数
    callHook(vm, 'destroyed')
    // turn off all instance listeners.
    // 关闭 vm 上的所有监听器实例
    vm.$off()
    // TODO: __vue__ ???
    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // release circular reference (#6759)
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

// 被 entry-runtime.js 中的 mount 函数进行调用的方法
// 真正的 mount 挂载函数。 实际渲染的规则是利用了 $options.render 函数
export function mountComponent(
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  // $el 的值是组件模板根元素的引用。 vm.$el 始终是组件模板的根元素， 所以如果传了 template 的值（main.js 中）
  // 那么根元素 $el 的值是 template 的节点， 否则的话，可能是 el （id 选择器）指向的节点
  // TODO:
  // 通常来说 el 这里是个字符串比较多 ？
  // 首次加载的时候 el 的值是通过 query(el) 查出来的，<div id="app"></div>
  vm.$el = el
  // 检查 render 渲染函数是否存在。 
  // 如果是 vue 自己编译的 template 而在 $options 挂载的 render 函数的话（因为如果开发者传参了 render 选项，vue 就不会编译了）
  // render 肯定是有结果的，最多是个 noop 空函数。 所以在 vue mount 中调用 mountComponent 函数时不会走入这里的逻辑
  if (!vm.$options.render) {
    // 这里肯定不是 template 字符串模板编译成 render 后的直接执行。 
    // 此时渲染函数的作用将仅仅渲染一个空的 `vnode` 对象， 创建空的 vnode 节点。 
    vm.$options.render = createEmptyVNode // 空的 vnode 节点是注释节点
    // 非生产环境下打印告警信息
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  // 触发 beforeMount 的生命钩子函数。顾名思义，beforeMount 钩子函数发生在 mount，也就是 DOM 挂载之前，在执行 vm._render() 函数渲染 VNode 之前，执行了 beforeMount 钩子函数
  callHook(vm, 'beforeMount')

  // 定义并初始化 `updateComponent` 函数
  let updateComponent
  /* istanbul ignore if */
  // 非生产环境下的性能统计
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    // 跟上面的功能相同
    // const vnode = vm._render()
    // vm._update(vnode, hydrating)
    // updateComponent 作用: 把渲染函数生成的虚拟DOM渲染成真正的DOM
    updateComponent = () => {
      // vm._render() 实例的 vm.$options.render:  _render() 函数执行结束之后返回的是一个虚拟节点 vnode 节点
      // `vm._update` 函数的作用是把 `vm._render` 函数生成的虚拟节点渲染成真正的 `DOM`
      // `vm._update` 内部是通过虚拟DOM的补丁算法(`patch`)来完成的
      // vm._render() return 的是一个 vnode 也就是说 _update 函数第一个参数是 vnode。 _render 函数定义在 instance/render.js 中
      // 在此方法中调用 vm._render 方法先生成虚拟 Node，最终调用 vm._update 更新 DOM
      vm._update(vm._render(), hydrating)
    }
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  // 我们在 Watcher 的构造函数中设置为 vm._watcher ，因为 watcher的初始补丁可能调用$forceUpdate(例如在子组件的挂载钩子中)，
  // 它依赖于已经定义的 vm._watcher
  // 因为 `watcher` 对表达式的求值，触发了数据属性的 `get` 拦截器函数，从而收集到了依赖，当数据变化时能够触发响应.
  // TODO: 哪里求值了啊
  // `Watcher` 的原理是通过对“被观测目标”的求值，触发数据属性的 `get` 拦截器函数从而收集依赖， 至于“被观测目标”到底是表达式还是函数或者是其他形式的内容都不重要，
  // 重要的是“被观测目标”能否触发数据属性的`get` 拦截器函数
  // mountComponent 核心就是先实例化一个渲染Watcher，在它的回调函数中会调用 updateComponent 方法
  // Watcher 在这里起到两个作用，一个是初始化的时候会执行回调函数，另一个是当 vm 实例中的监测的数据发生变化的时候执行回调函数
  new Watcher(vm, updateComponent, noop, {
    // 当数据变化之后，触发更新之前，如果 `vm._isMounted` 属性的值为真，则会调用 `beforeUpdate` 生命周期钩子。
    // beforeUpdate 的执行时机是在渲染 Watcher 的 before 函数中
    before() {
      // 在组件已经 mounted 之后，才会去调用这个钩子函数
      if (vm._isMounted) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher 标识着是否是渲染函数的观察者*/)
  // 当期这个观察者实例 
  // watcher.getter = updateComponent
  // watcher.before = before
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // 手动挂载实例，在自挂载上挂载的调用调用其插入的钩子中的委托方创建的子组件
  // 主动触发 mounted 钩子函数，并且将 vm 的 _isMounted 属性设置为 true 表示已经被挂载的
  // $vnode 是在 _render 函数执行的时候挂载上去的，值是 _parentVnode ，也就是父虚拟节点
  //  vm.$vnode 表示 Vue 实例的父虚拟 Node， 它为 Null 则表示当前是根 Vue 的实例
  if (vm.$vnode == null) {
    // 表示这个实例已经挂载了
    vm._isMounted = true
    // 执行用户在 mounted 中定义的任务。在执行完 vm._update() 把 VNode patch 到真实 DOM 后，执行 mouted 钩子
    callHook(vm, 'mounted')
  }
  return vm
}

// 更新 child 组件
export function updateChildComponent(
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: MountedComponentVNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {
    // 正在更新组件
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  // 重写 $options._renderChildren 之前需要确组件是否有 slots 子节点
  const hasChildren = !!(
    renderChildren ||               // has new static slots 新的静态插槽
    vm.$options._renderChildren ||  // has old static slots 旧的静态插槽
    parentVnode.data.scopedSlots || // has new scoped slots 新的范围插槽
    vm.$scopedSlots !== emptyObject // has old scoped slots 旧的范围插槽
  )

  // 在 options 参数上挂载一个”私有的“ 父虚拟节点， 后面蛮多地方要用的
  vm.$options._parentVnode = parentVnode
  // 占位符 vm.$vnode 的更新。 不通过重新渲染，直接更新实例的占位符节点（父节点）。
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  // _vnode 当前的 vm 实例渲染出的虚拟节点
  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  // TODO:
  // slot 的更新
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data.attrs || emptyObject
  // listeners 的更新
  vm.$listeners = listeners || emptyObject

  // update props. props 的更新
  if (propsData && vm.$options.props) {
    toggleObserving(false)
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      const propOptions: any = vm.$options.props // wtf flow?
      props[key] = validateProp(key, propOptions, propsData, vm)
    }
    toggleObserving(true)
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // update listeners
  listeners = listeners || emptyObject
  const oldListeners = vm.$options._parentListeners
  vm.$options._parentListeners = listeners
  updateComponentListeners(vm, listeners, oldListeners)

  // resolve slots + force update if has children
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree(vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

export function activateChildComponent(vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent(vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

// 触发钩子
export function callHook(vm: Component, hook: string) {
  // #7573 disable dep collection when invoking lifecycle hooks
  // 在调用生命周期钩子时禁用 dep 集合， 其实就是给 Dep.target 置为 undefined 值，但是 targetStack 数组中还是会 push 进入一个函数的
  pushTarget()
  // TODO: 我记得钩子函数是数组 ？
  // 获取 vm 实例上定义的钩子函数
  const handlers = vm.$options[hook]
  if (handlers) {
    // 循环触发数组中的 handler
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }
  // TODO: 
  // _hasHookEvent 这个标志位是用来表示是否有钩子函数，貌似说是提高速度 ？
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
  // 本质上是不希望依赖收集的，所以将栈中的 函数删除
  popTarget()
}
