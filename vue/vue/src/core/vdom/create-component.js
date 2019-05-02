/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
// 在 patch 期间将在组件 vnode 上调用内联钩子。 应该不同于组件的钩子函数
const componentVNodeHooks = {
  // 初始化 钩子函数
  init(vnode: VNodeWithData, hydrating: boolean): ?boolean {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      // 当作补丁对待
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      // 通过 `createComponentInstanceForVnode` 创建一个 Vue 的实例，然后调用 `$mount` 方法挂载子组件
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance // vm vue 实例（暂时理解可以创建 vnode）
      )
      // `hydrating` 为 true 一般是服务端渲染的情况，我们只考虑客户端渲染，所以这里 `$mount` 相当于执行 `child.$mount(undefined, false)`
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  // 拿到新的 vnode 的组件配置以及组件实例，去执行 updateChildComponent 方法
  prepatch(oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    // TODO:
    // componentOptions componentInstance
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    updateChildComponent(
      child, // vm 实例
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  insert(vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      // 每个子组件都是在这个钩子函数中执行 mouted 钩子函数
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  destroy(vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      // 当组件并不是 keepAlive 的时候，会执行 componentInstance.$destroy() 方法，然后就会执行 beforeDestroy & destroyed 两个钩子函数
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

// 创建一个组件节点.
// 针对组件渲染这个 case 主要就 3 个关键步骤：
// 1. 构造子类构造函数
// 2. 安装组件钩子函数
// 3. 实例化 vnode。
export function createComponent(
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  // 构造函数必传
  if (isUndef(Ctor)) {
    return
  }
  // 构造子类构造函数
  // Vue.options._base = Vue
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  // 如果构造函数是一个对象， 就扩展属性进 baseCtor 基础构造函数中 ？
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  // 如果在该阶段Ctor依然不是一个构造函数或者是一个异步组件工厂则直接返回
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // 参数就是我们的异步组件对象
  // Vue.component('async-example', function (resolve, reject) {
  //   // 这个特殊的 require 语法告诉 webpack
  //   // 自动将编译后的代码分割成不同的块，
  //   // 这些块将通过 Ajax 请求自动下载。
  //   require(['./my-async-component'], resolve)
  // })
  // async component
  // 处理异步组件
  let asyncFactory
  // 传入的 Ctor 是一个函数，不会执行 extend ，因此 cid 不存在。 
  if (isUndef(Ctor.cid)) {
    // 暂存旧的构造函数，到最后进行调用
    asyncFactory = Ctor
    // 进入了异步组件创建的逻辑。
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // install component management hooks onto the placeholder node
  // snabbdom，它的一个特点是在 VNode 的 patch 流程中对外暴露了各种时机的钩子函数，方便我们做一些额外的事情
  // Vue.js 也是充分利用这一点，在初始化一个 Component 类型的 VNode 的过程中实现了几个钩子函数
  // 安装组件钩子函数
  installComponentHooks(data)

  // 实例化 VNode
  // 通过 new VNode 实例化一个 vnode 并返回。需要注意的是和普通元素节点的 vnode 不同，组件的 vnode 是没有 children 的，这点很关键
  // return a placeholder vnode
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  return vnode
}

// 为虚拟节点创建组件实例
export function createComponentInstanceForVnode(
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
): Component {
  const options: InternalComponentOptions = {
    // `_isComponent` 为 `true` 表示它是一个组件
    _isComponent: true,
    // 父虚拟节点
    _parentVnode: vnode,
    // `parent` 表示当前激活的组件实例
    parent
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // 构造的一个内部组件的参数，然后执行 `new vnode.componentOptions.Ctor(options)`
  // Ctor 对应的就是子组件的构造函数
  return new vnode.componentOptions.Ctor(options)
}

// 安装组件钩子函数
function installComponentHooks(data: VNodeData) {
  // 把 componentVNodeHooks 的钩子函数合并到 data.hook 中
  const hooks = data.hook || (data.hook = {})
  // patch 的钩子函数
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    // 已存在的 hook ，可以理解为 component 自定义的 hook
    // TODO: 不过这里 patch 的钩子函数应该不同于组件的钩子函数， 比如组件没有 inserted 的钩子函数
    const existing = hooks[key]
    // patch 默认的钩子函数
    const toMerge = componentVNodeHooks[key]
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

// 合并钩子函数反正就是两个钩子函数都执行一遍
function mergeHook(f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b)
    f2(a, b)
  }
  merged._merged = true
  return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
function transformModel(options, data: any) {
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
    ; (data.props || (data.props = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  if (isDef(on[event])) {
    on[event] = [data.model.callback].concat(on[event])
  } else {
    on[event] = data.model.callback
  }
}
