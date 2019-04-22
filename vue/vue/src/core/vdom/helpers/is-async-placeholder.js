/* @flow */

export function isAsyncPlaceholder(node: VNode): boolean {
  // 使用异步组件工厂函数最常见的场景是配合 vue-router 使用的 bundle js 分割， 组件模块会被分割成小块的 js 文件
  // 只有路由加载到的时候才会加载
  // isComment 注释组件。 asyncFactory 异步组件工厂函数。
  return node.isComment && node.asyncFactory
}
