/* @flow */
// 首先, template 字符串会被编译成 AST(抽象语法树)，简单说就是用 js 代码来抽象出 dom 树的表现形式。
// 接着, AST 会经过 generate 得到 render 函数， render 返回的结果是 VNODE, VNODE 是 vue 的虚拟节点。

export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node

  // strictly internal
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?
  asyncFactory: Function | void; // async component factory function
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes
  fnOptions: ?ComponentOptions; // for SSR caching
  fnScopeId: ?string; // functional scope id support

  constructor(
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function // 异步组件工厂函数
  ) {
    // 当前节点的标签名
    this.tag = tag
    // 当前节点对应的对象，包含了具体的一些数据信息，是一个VNodeData类型，可以参考VNodeData类型中的数据信息
    this.data = data
    // 当前节点的子节点，是一个数组
    this.children = children
    // 当前节点对应的文本
    this.text = text
    // 当前虚拟节点对应的真实 dom 节点
    this.elm = elm
    // namespace 节点的命名空间
    this.ns = undefined
    // 编译作用域
    this.context = context
    // 函数组件化作用域
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    // 节点的key属性，被当作节点的标志，用以优化
    this.key = data && data.key
    // 组件的 option 选项
    this.componentOptions = componentOptions
    // 当前节点对应的组件的实例
    this.componentInstance = undefined
    // 当前节点的父节点
    this.parent = undefined
    // 简而言之就是是否为原生HTML或只是普通文本，innerHTML的时候为true，textContent的时候为false
    this.raw = false
    // 静态节点标志
    this.isStatic = false
    // 是否作为跟节点插入
    this.isRootInsert = true
    // 是否为注释节点
    this.isComment = false
    // 是否为克隆节点
    this.isCloned = false
    // 是否有v-once指令
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    // 是否是异步占位符
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child(): Component | void {
    return this.componentInstance
  }
}

// 创建一个空的 vnode 节点
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  // 是否为注释节点
  node.isComment = true
  return node
}

// 创建一个文本节点
export function createTextVNode(val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
// 克隆一个 vnode 节点
// 用于静态节点和插槽节点经过优化的浅克隆 ，因为它们可以跨多个呈现重用，当DOM操作依赖于它们的elm引用时，克隆它们可以避免错误。
export function cloneVNode(vnode: VNode): VNode {
  // VNODE 构造函数只传 8 个参数
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  cloned.isCloned = true
  return cloned
}
