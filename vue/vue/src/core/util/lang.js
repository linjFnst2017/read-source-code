/* @flow */

/**
 * Check if a string starts with $ or _
 */
export function isReserved(str: string): boolean {
  // charCodeAt 返回字符串指定位置的 code 码
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * 为对象定义一个属性
 */
export function def(obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    // 未设置 set 和 get 函数， 那通过 defineProperty 这个函数的意思在哪里？
    // 本来还想说这里为啥要通过 Object.defineProperty 来定义, 比如需要设置成不被遍历，只读属性等特征。
    value: val,
    // enumerable 是否可以被枚举
    enumerable: !!enumerable,
    // 默认不能被改变
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 * **`Watcher` 只接受简单的点(`.`)分隔路径
 */
const bailRE = /[^\w.$]/
export function parsePath(path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  // `parsePath` 返回的新函数将作为 `this.getter` 的值，只有当 `this.getter` 被调用的时候，这个函数才会执行
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
