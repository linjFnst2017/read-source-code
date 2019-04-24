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
  // 更新， Vue 的响应式原理中，set 函数触发重新渲染就是用的 _update 函数
  // hydrating 保湿的
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    // 获取之前（当前）渲染的 dom 节点和 _vnode 节点 （也就是一个真实的节点，一个虚拟节点）
    // $el 在执行这个函数的时候应该是 undefined 吧， 后来在 mountComponent 函数中 $el 被赋值为 el 挂载的节点
    const prevEl = vm.$el
    // TODO: _vnode 最早是什么时候挂载的
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    // 当前激活的实例
    activeInstance = vm
    // _vnode 保存 dom 对应的虚拟节点，这里需要更新为新的 vnode 对应的 dom ，所以 _vnode 也需要更新
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // TODO: 
    // Vue.prototype.__patch__ 函数在 render 函数执行之后每一个实例上都被注入了。 
    if (!prevVnode) {
      // initial render
      //  `vm.__patch__` 函数的返回值是一个真实的 dom 节点。
      // （如果上一个 vnode 节点不存在的话）初次渲染，就直接调用 __patch__ ?
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

  Vue.prototype.$destroy = function () {
    const vm: Component = this
    // _isBeingDestroyed 已经正在被销毁中 ？
    if (vm._isBeingDestroyed) {
      return
    }
    // 触发定义的 beforeDestroy 钩子函数
    callHook(vm, 'beforeDestroy')
    // 标志位
    vm._isBeingDestroyed = true
    // remove self from parent
    // 从父节点中移除自身
    const parent = vm.$parent
    // 父节点此时没有正在被销毁， 并且父节点也不能是抽象组件。 事实上这里如果是抽象组件的话，不能从父节点中移除 ？？？
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      // 从父节点的 $children 数组中将当前节点移除
      remove(parent.$children, vm)
    }
    // teardown watchers
    // 拆卸 watcher。 因为组件被销毁了，依赖监听可以不用执行了，下一次如果节点再被加载的话，依赖收集的操作应该在挂载之前 ？？？
    if (vm._watcher) {
      // TODO: 
      vm._watcher.teardown()
    }
    // TODO: 怎么有 _watcher 还有 _watchers 
    let i = vm._watchers.length
    // 全部监听器都拆卸调
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
    // 在真实 dom 上移除
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

// 真正的 mount 挂载函数。 实际渲染的规则是利用了 $options.render 函数
export function mountComponent(
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  // $el 的值是组件模板根元素的引用。 vm.$el 始终是组件模板的根元素， 所以如果传了 template 的值（main.js 中）
  // 那么根元素 $el 的值是 template 的节点， 否则的话，可能是 el （id 选择器）指向的节点
  vm.$el = el
  // 检查 render 渲染函数是否存在
  if (!vm.$options.render) {
    // 这里肯定不是 template 字符串模板编译成 render 后的直接执行。 
    // 此时渲染函数的作用将仅仅渲染一个空的 `vnode` 对象， 创建空的 vnode 节点
    vm.$options.render = createEmptyVNode
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
  // 触发 beforeMount 的生命钩子函数
  callHook(vm, 'beforeMount')

  // 定义并初始化 `updateComponent` 函数
  let updateComponent
  /* istanbul ignore if */
  // 性能统计
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
    // 跟上面的功能相同 ，
    // const vnode = vm._render()
    // vm._update(vnode, hydrating)
    // updateComponent 作用: 把渲染函数生成的虚拟DOM渲染成真正的DOM
    updateComponent = () => {
      // vm._render() 实例的 vm.$options.render:  _render() 函数执行结束之后返回的是一个虚拟节点 vnode 节点
      // `vm._update` 函数的作用是把 `vm._render` 函数生成的虚拟节点渲染成真正的 `DOM`
      // `vm._update` 内部是通过虚拟DOM的补丁算法(`patch`)来完成的
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
  // `Watcher` 的原理是通过对“被观测目标”的求值，触发数据属性的 `get` 拦截器函数从而收集依赖， 至于“被观测目标”到底是表达式还是函数或者是其他形式的内容都不重要，重要的是“被观测目标”能否触发数据属性的 `get` 拦截器函数
  new Watcher(vm, updateComponent, noop, {
    // 当数据变化之后，触发更新之前，如果 `vm._isMounted` 属性的值为真，则会调用 `beforeUpdate` 生命周期钩子。
    before() {
      if (vm._isMounted) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // 手动挂载实例，在自挂载上挂载的调用调用其插入的钩子中的委托方创建的子组件
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

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
  const hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  )

  // 在 options 参数上挂载一个”私有的“ 父虚拟节点， 后面蛮多地方要用的
  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data.attrs || emptyObject
  vm.$listeners = listeners || emptyObject

  // update props
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
