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
  // v-once cached trees v-once 指令缓存静态 dom 结构
  vm._staticTrees = null
  const options = vm.$options
  // the placeholder node in parent tree 父树中的占位符节点
  // _parentVnode 属性是 lifecycle.js 中的一个函数挂载上去的
  const parentVnode = vm.$vnode = options._parentVnode
  const renderContext = parentVnode && parentVnode.context
  // 插槽相关两个 api
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  // TODO: 
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
  // helpers 是直接操作 Vue 的原型链的
  installRenderHelpers(Vue.prototype)

  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    // TODO:
    // 单个vue文件的中， options里是不需要写 render 和 _parentVnode 属性（函数）的，是什么时候被赋值了？
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

    if (_parentVnode) {
      vm.$scopedSlots = _parentVnode.data.scopedSlots || emptyObject
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.

    // TODO:
    vm.$vnode = _parentVnode
    // render self
    let vnode
    try {
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
    vnode.parent = _parentVnode
    return vnode
  }

}
