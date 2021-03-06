/* @flow */

import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

// 
export function initRender(vm: Component) {
  // the root of the child tree 子树的根
  // _vnode 挂载到 vm 实例上的地方（其实并没有什么问题，只是后面有很多地方会从 get vm._vnode ，所以这里做一个标记）
  vm._vnode = null
  // v-once cached trees 
  // v-once 指令缓存静态 dom 结构
  vm._staticTrees = null
  const options = vm.$options
  // the placeholder node in parent tree 父树中的占位符节点
  // _parentVnode 属性是 lifecycle.js 中的一个函数挂载上去的。 这里也对 $vnode 进行赋值了，表示的也是父虚拟节点。 不过根节点的话值为 null ？ 为啥不是 undefined ？
  const parentVnode = vm.$vnode = options._parentVnode
  const renderContext = parentVnode && parentVnode.context
  // 插槽相关两个 api
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates

  // vm._c 方法，它是被模板编译成的 render 函数使用
  // 而 vm.$createElement 是用户手写 render 方法使用的， 这俩个方法支持的参数相同，并且内部都调用了 createElement 方法。
  // 将 createElement 函数绑定到这个实例，以便在其中获得适当的呈现上下文。
  // args 顺序: 标签、数据、子元素、normalizationType、alwaysNormalize nternal 版本由模板编译的呈现函数使用
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in
  // user-written render functions.
  // 规范化的 createElement 函数被应用于公共对外的版本，用于用户自定义的 render 函数
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // TODO: 额。。 怎么又跟 hoc 有关系了？
  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  const parentData = parentVnode && parentVnode.data

  /* istanbul ignore else */
  // 浅层观察；并且没有去设置 setter 和 getter ，也就是说 这里只是通过 $attrs 代理一下而已，并不是真的需要把这个属性定义成响应式。
  // 而且也没理由去修改 $attrs 和 $listeners
  if (process.env.NODE_ENV !== 'production') {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}

export function renderMixin(Vue: Class<Component>) {
  // install runtime convenience helpers
  // helpers 是直接操作 Vue 的原型链的。 为 Vue.prototype 原型链上挂载很多跟渲染相关的函数，估计因为都是内部渲染的时候进行调用，名字都比较诡异
  installRenderHelpers(Vue.prototype)

  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  // 它用来把实例渲染成一个虚拟 Nod
  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    // 单个 vue 文件的中， options里是不需要写 render 和 _parentVnode 属性（函数）的，是什么时候被赋值了？
    //  `_parentVnode` 就是当前组件的父 VNode
    const { render, _parentVnode } = vm.$options

    // reset _rendered flag on slots for duplicate slot check
    if (process.env.NODE_ENV !== 'production') {
      for (const key in vm.$slots) {
        // $flow-disable-line
        // TODO:
        // vm.$slots 值为vue实例中定义的 具名插槽数组，具体每一个元素的值，可能是一个 dom 节点 ？ 但是_rendered 属性是什么时候被定义的？代表什么值？
        // _rendered = false 表示
        vm.$slots[key]._rendered = false
      }
    }

    // 如果父节点存在，并且 data 中包含了 scopedSlots 属性的话，就挂在到 $scopedSlots 上去
    // TODO: scopedSlots 属性是如何到 data 上去的
    if (_parentVnode) {
      vm.$scopedSlots = _parentVnode.data.scopedSlots || emptyObject
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    // 设置父节点vnode。这允许呈现函数访问占位符节点上的数据

    // （设置）更新 $vnode 上的父虚拟节点内容。这里很可能是第一个设置的
    vm.$vnode = _parentVnode
    // render self
    let vnode
    try {
      // new Vue 初始化一个函数的时候，手写 render 函数里的参数 h 就是这里的 vm.$createElement 也就是 createElement 函数
      // 这里的 h 是 createElement 方法
      // render: h => h(App)
      // 
      //  `render` 函数生成的 `vnode` 当前组件的渲染 `vnode
      // render 函数的第一个参数是 createElement 也就是这里的 vm.$createElement
      // vm._renderProxy 是在  _init 函数执行的之后，非生产环境时， vm._renderProxy === vm 
      // 线上的时候看支不支持 Proxy 支持的话， vm._renderProxy === new Proxy(...) 否则的话跟 vm 一样
      // 至于 vm.$createElement 简单理解为就是 _createElement 函数
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        if (vm.$options.renderError) {
          try {
            vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
          } catch (e) {
            handleError(e, vm, `renderError`)
            vnode = vm._vnode
          }
        } else {
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    }
    // return empty vnode in case the render function errored out
    // 返回空的vnode，以防 render 函数出错
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    // `vnode` 的 `parent` 指向了 `_parentVnode`，也就是 `vm.$vnode`
    vnode.parent = _parentVnode
    return vnode
  }

}
