/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 缓存旧的变异方法
  const original = arrayProto[method]
  // 通过 Object.defineProperty 在 arrayMethods 数组上（隐式原型链指向数组的原型链）定义不可遍历数组变异同名函数
  def(arrayMethods, method, function mutator(...args) {
    // 先需要执行缓存的旧的变异方法
    const result = original.apply(this, args)
    // 无论是数组还是对象，都将会被定义一个 __ob__ 属性， 并且 __ob__.dep 中收集了所有该对象(或数组)的依赖(观察者)。
    const ob = this.__ob__
    // 新增加的元素是非响应式的，所以我们需要获取到这些新元素，并将其变为响应式数据才行
    // inserted 变量中所保存的就是新增的数组元素
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      // splice 函数从第三个参数开始到最后一个参数都是数组的新增元素，所以直接使用 args.slice(2) 作为 inserted 
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 数组值被观察
    if (inserted) ob.observeArray(inserted)
    // notify change 通知依赖改变了， 当调用数组变异方法时，必然修改了数组，所以这个时候需要将该数组的所有依赖(观察者)全部拿出来执行
    ob.dep.notify()
    return result
  })
})
