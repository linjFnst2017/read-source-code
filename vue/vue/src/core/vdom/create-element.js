/* @flow */

import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'
import { traverse } from '../observer/traverse'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject,
  isPrimitive,
  resolveAsset
} from '../util/index'

import {
  normalizeChildren,
  simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
// 包装器函数，用于提供更灵活的接口，而不会受到 flow 的报错
// 这里的 h 是 createElement 方法， 而 App 是第一个参数 context 的值
// render: h => h(App)
export function createElement(
  // VNode 的上下文环境
  context: Component,
  // tag 表示标签，它可以是一个字符串，也可以是一个 Component
  tag: any,
  // data 表示 VNode 的数据，它是一个 VNodeData 类型
  data: any,
  //  VNode 的子节点，它是任意类型的， 接下来需要被规范为标准的 VNode 数组
  children: any,
  // normalizationType 表示子节点规范的类型，类型不同规范的方法也就不一样，它主要是参考 render 函数是编译生成的还是用户手写的。
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  // 兼容不传 data 的情况
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  // 设置为常量 ？
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  // 创建虚拟节点 vnode
  return _createElement(context, tag, data, children, normalizationType)
}

// 创建虚拟节点, 返回的是 vnode
// createElement 创建 VNode 的过程，每个 VNode 有 children，children 每个元素也是一个 VNode，这样就形成了一个 VNode Tree，它很好的描述了我们的 DOM Tree
export function _createElement(
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> { // 返回 vnode 节点
  // 如果传的参数 data 已经拥有 __ob__ 属性，表示已经挂载了一个 Observer 对象，被观察。 
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    )
    // 那么创建一个空节点
    return createEmptyVNode()
  }
  // object syntax in v-bind
  // TODO: data.is ?
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  // 如果 没有标签值， 也创建一个空节点
  if (!tag) {
    // 如果组件:被设置为falsy值 ？ 
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // warn against non-primitive key
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    if (!__WEEX__ || !('@binding' in data.key)) {
      warn(
        'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
        context
      )
    }
  }
  // support single function children as default scoped slot
  // 默认作用域插槽
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }
  // 根据 normalizationType 的不同，调用了 normalizeChildren(children) 和 simpleNormalizeChildren(children) 方法
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }

  // 经过上面对于 children 规范化之后，接下来会去创建一个 VNode 的实例
  let vnode, ns
  // 如果是一个普通的 html 标签，实例化一个普通 VNode 节点
  if (typeof tag === 'string') {
    let Ctor
    // 获取tag的名字空间
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    // 判断是否是保留的标签， 是的话则直接创建一个普通 VNode
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      // 如果是保留的标签则创建一个相应节点
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // 如果是为已注册的组件名，则通过 createComponent 创建一个组件类型的 VNode
      // component
      // 从 vm 实例的 option 的 components 中寻找该 tag，存在则就是一个组件，创建相应节点，Ctor 为组件的构造类
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // 否则创建一个未知的标签的 VNode。
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 未知的元素，在运行时检查，因为父组件可能在序列化子组件的时候分配一个名字空间
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // 如果是 tag 一个 Component 类型，则直接调用 createComponent 创建一个组件类型的 VNode 节点
    // direct component options / constructor
    // TODO: 
    // tag 不是字符串的时候则是组件的构造类. tag 作为 createComponent 函数的第一个参数是 Ctor 一个构造函数？
    vnode = createComponent(tag, data, context, children)
  }

  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    // 如果有名字空间，则递归所有子节点应用该名字空间
    if (isDef(ns)) applyNS(vnode, ns)
    if (isDef(data)) registerDeepBindings(data)
    return vnode
  } else {
    // 如果vnode没有成功创建则创建空节点
    return createEmptyVNode()
  }
}

// （修改）应用名字空间
function applyNS(vnode, ns, force) {
  vnode.ns = ns
  // 外部对象 ？
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    ns = undefined
    force = true
  }
  // 如果当期的虚拟节点有子对象的话
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (isDef(child.tag) && (
        isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) {
        applyNS(child, ns, force)
      }
    }
  }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
function registerDeepBindings(data) {
  if (isObject(data.style)) {
    traverse(data.style)
  }
  if (isObject(data.class)) {
    traverse(data.class)
  }
}
