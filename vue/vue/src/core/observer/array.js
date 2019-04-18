/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

// 获得原生数组的原型
const arrayProto = Array.prototype
// 创建一个新的数组对象，并在此对象的基础上重写数组的七个方法，避免对原生数组对象造成污染
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
 * 从数组的原型新建一个Object.create(arrayProto)对象，通过修改此原型可以保证原生数组方法不被污染。
 * 如果当前浏览器支持__proto__这个属性的话就可以直接覆盖该属性则使数组对象具有了重写后的数组方法。
 * 如果没有该属性的浏览器，则必须通过遍历def所有需要重写的数组方法，这种方法效率较低，所以优先使用第一种。
 * 
 * 在保证不污染不覆盖数组原生方法添加监听，主要做了两个操作，第一是通知所有注册的观察者进行响应式处理，第二是如果是添加成员的操作，需要对新成员进行observe。
 * 
 * 但是修改了数组的原生方法以后我们还是没法像原生数组一样直接通过数组的下标或者设置length来修改数组，可以通过Vue.set以及splice方法
 * 
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 缓存旧的变异方法， 重写的函数里面还需要调用旧的方法以保持操作结果不变
  const original = arrayProto[method]
  // 通过 Object.defineProperty 在 arrayMethods 数组上（隐式原型链 __proto__ 指向数组的原型链 prototype）定义不可遍历数组变异同名函数
  // mutator: 新增变异
  def(arrayMethods, method, function mutator(...args) {
    // 先需要执行缓存的旧的变异方法
    const result = original.apply(this, args)
    // 无论是数组还是对象，都将会被定义一个 __ob__ 属性， 并且 __ob__.dep 中收集了所有该对象(或数组)的依赖(观察者)。
    // 数组新插入的元素需要重新进行observe才能响应式， __ob__ 值就是一个 Observer 实例
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
      // splice 函数是直接对原数组进行修改；从第一个参数开始，删除第二个参数值的个数的成员，并在操作后的数组最后添加第三个参数到最后一个参数的值作为新成员
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 数组值被观察， ob 是一个观察者，用于观察整个数组的所有成员的方法(observeArray) 和用于观察一个对象的所有属性的方法 (walk)
    // 数组 inserted 有值的话，就说明对数组添加了新成员，新的成员的内容需要被观察。 args 在这里简单理解为就是参数组成的数组吧。
    if (inserted) ob.observeArray(inserted)
    // 观察者 ob 中的 dep 是一个记录依赖信息的容器
    // notify change 通知依赖改变了， 当调用数组变异方法时，必然修改了数组，所以这个时候需要将该数组的所有依赖(观察者)全部拿出来执行
    ob.dep.notify()
    return result
  })
})
