/* @flow */

/**
 * Check if a string starts with $ or _
 */
export function isReserved(str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * 为对象定义一个属性
 */
export function def(obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    // TODO: 
    // 未设置 set 和 get 函数， 那通过 defineProperty 这个函数的意思在哪里 ？
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
 */
const bailRE = /[^\w.$]/
export function parsePath(path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
