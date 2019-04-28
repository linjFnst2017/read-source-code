/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
// 因为设置了 deep 后会执行 traverse 函数，会有一定的性能开销，所以一定要根据应用场景权衡是否要开启这个配置 
export function traverse(val: any) {
  // Set() 可以避免重复访问
  _traverse(val, seenObjects)
  seenObjects.clear()
}

// 对一个对象做深层递归遍历
function _traverse(val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  // val 已经是一个被观察的对象，现在需要深度观察他的属性中的所有对象或者数组
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    // 优化的点：
    // 遍历过程中会把子响应式对象通过它们的 dep id 记录到 seenObjects，避免以后重复访问。
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    // 遍历过程中就是对一个子对象的访问，会触发它们的 getter 过程，这样就可以收集到依赖，也就是订阅它们变化的 watcher
    keys = Object.keys(val)
    i = keys.length
    // val[keys[i]] 求值，触发 get ，收集依赖
    while (i--) _traverse(val[keys[i]], seen)
  }
}
