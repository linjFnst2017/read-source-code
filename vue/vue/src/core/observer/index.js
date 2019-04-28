/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

// 通过 Object.getOwnPropertyNames 函数获取所有属于 arrayMethods 对象自身的键
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 * 在某些情况下，我们可能希望禁用组件更新计算中的观察。
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

  constructor(value) {
    this.value = value
    // 依赖数组容器，不是属于某一个属性的，而是属于整个 data 对象或者数组的， 比如 new Vue 创建实例的时候的 data 
    this.dep = new Dep()
    // 将此对象作为根$data的vm数量
    this.vmCount = 0

    // 定义不可枚举的属性， 防止被业务代码中对 data 的遍历拿到这个键
    // 将Observer实例绑定到data的__ob__属性上面去
    // 其实通过实际打印得知， __ob__ 是一个 Observer 实例，内部包含一个 Dep 实例，一个 value 值（value 值就是被观察的 value）以及 vmCount
    def(value, '__ob__', this)

    // 执行完上面代码之后属于 data 对象被扩展了一个不可枚举属性
    // const data = {
    //   a: 1,
    //   // __ob__ 是不可枚举的属性
    //   __ob__: {
    //     value: data, // value 属性指向 data 数据对象本身，这是一个循环引用
    //     dep: dep实例对象, // new Dep()
    //     vmCount: 0
    //   }
    // }
    // 区分数据对象到底是数组还是一个纯对象, 对数组需要进行不一样的观察模式
    // @Wonderful: vue 中将数组声明成响应式的办法
    // TODO: es6 的 proxy 支持直接监听数组的改变么？ 如果支持的话， 数组就不用做特殊处理了。
    if (Array.isArray(value)) {
      // 数组实际也是一个对象，它的 __proto__ 指向了数组的原型链 arr.__proto__ === Array.prototype
      // 而数组的原生方法入 push pop 等都是挂载在原型链上的。
      const augment = hasProto
        // 大部分现代浏览器都会走到 protoAugment
        // hasProto 是用来检测当前环境是否支持 __proto__ 属性，这个属性仅在 ie11 以上才开始支持
        // ie 中不支持直接进行修改上级的属性 __proto__ 因为这不是标准方法，标准方法是 Object.getPrototypeOf()
        // 直接覆盖原型的方法来修改目标对象
        ? protoAugment
        // 当前环境不支持 __proto__ 属性的时候做兼容处理
        // 定义（覆盖）目标对象或数组的某一个方法
        : copyAugment
      augment(value, arrayMethods, arrayKeys)
      // 如果是数组则需要遍历数组的每一个成员进行observe， 使嵌套的数组或对象同样是响应式数据
      this.observeArray(value)
    } else {
      // 观察所有的 value 中的属性
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk(obj: Object) {
    // 枚举可观察属性
    const keys = Object.keys(obj)
    // walk方法会遍历对象的每一个属性进行defineReactive绑定
    for (let i = 0; i < keys.length; i++) {
      // 定义响应式函数. 在 obj 上将所有的属性都声明成响应式。此时已经有 obj.__ob__  === Observer 实例
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   * 观察数组
   * items 是一个数组，它自身的 __ob__ 是在上一层循环的时候就被添加上了。而这里的 observeArray 最主要的工作是寻找 items 的成员中是否有对象或者数组
   * 有的话就声明成响应式，否则的话几乎什么都不用做。
   */
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      // 返回值是一个 __ob__。 
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object, keys: any) {
  // 用来将数组实例的原型指向代理原型(arrayMethods)
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
// 
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    // 通过 for 循环对其进行遍历，并使用 def 函数在数组实例上定义与数组变异方法同名的且不可枚举的函数
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// Vue的响应式数据都会有一个__ob__的属性作为标记，里面存放了该属性的观察器，也就是Observer的实例，防止重复绑定。
// 尝试创建一个Observer实例（__ob__），如果成功创建Observer实例则返回新的Observer实例，如果已有Observer实例则返回现有的Observer实例
export function observe(value: any, asRootData: ?boolean): Observer | void {
  // vnode 对象当然不能去观察，因为这里是观察跟渲染有关、或者是开发者主动 watch 的对象和数组
  // number string boolean 等这些基本类型会直接就 return 了，简单说 Vue 的 observe 只会观察数组和对象
  if (!isObject(value) || value instanceof VNode) {
    // 不是一个对象(因为是 typeof 来判断的，这里包括数组)或者是 `VNode` 实例
    return
  }
  // 用来保存 Observer （观察者）对象
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 当一个数据对象被观测之后将会在该对象上定义 `__ob__` 属性， 所以这里如果一个数据已经被观察了的话，对象上会有 __ob__ 属性
    // 如果已经被观察的对象就直接覆盖？ 避免依赖重复收集
    ob = value.__ob__
  } else if (
    shouldObserve &&
    // 只有当不是服务端渲染的时候才会观测数据
    !isServerRendering() &&
    // value 是一个数组， 这里的判断是为了确保value是单纯的对象，而不是函数或者是Regexp等情况
    (Array.isArray(value) || isPlainObject(value)) &&
    // 判断一个对象是否是可扩展的， 因为需要在 value 对象上添加一个 __ob__
    Object.isExtensible(value) &&
    // 不是 vue 实例
    !value._isVue
  ) {
    // 对象没有被观察过
    // Observer 的作用就是遍历对象的所有属性声明成响应式的，并且返回的结果是一个 __ob__ 对象。 
    // TODO: 挂载 __ob__ 这个属性的意义是什么？ 仅仅是为了判断是否被观察过的没必要 ？
    // 可以理解为只要对象中拥有 __ob__ 属性的话（包含 value dep 和 vmCount）这个对象就已经被声明为响应式的了。
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    // 如果是根数据则计数，后面 Observer 中的observe的 asRootData 非true
    ob.vmCount++
  }
  return ob
}

/**
 * 在一个对象上定义一个响应式属性
 * 核心就是 **将数据对象的数据属性转换为访问器属性**， 即为数据对象的属性设置一对 `getter/setter`
 */
export function defineReactive(
  obj: Object,
  key: string,
  // 这里的 val 也是不一定有值的， flow 应该写有 ？
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 订阅器，响应式关键（值改变之后能够推送 ？）
  // 在闭包中定义一个dep对象依赖收集容器。 实例化一个 Dep 的实例。
  const dep = new Dep()

  // 方法返回指定对象上一个自有属性对应的属性描述符。（自有属性指的是直接赋予该对象的属性，不需要从原型链上进行查找的属性）
  // 获取该字段可能已有的属性描述对象
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // configurable 是否可配置，writable 是否可以被更改，后者优先级更高。https://www.cnblogs.com/asdfq/p/7011396.html
  if (property && property.configurable === false) {
    // 如果不可配置就直接 return 了
    return
  }

  // 保存来自 `property` 对象的 `get` 和 `set` 函数，  `property` 对象是属性的描述对象，一个对象的属性很可能已经是一个访问器属性了，所以该属性很可能已经存在 `get` 或 `set` 方法。
  // cater for pre-defined getter/setters
  // 这里的 getter 和 setter 函数一般 data 对象执行到这里都是已经存在了的，通过的是 proxy(vm, `_data`, key) 这个函数
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // shallow: true 浅观察， 也就是说不需要观察 child， childOb === undefined
  // 默认就是深度观测， val 属性如果是一个对象的话，就需要被继续观测， 但是这里 val 未必有值, 如果 val 未被定义，undefined isObject 函数判断之后不会继续执行下去
  // 深度观察的话， observe 函数返回的是 __ob__ , 即一个 Observer 实例。这里是在递归调用 observe， 为每一个值也进行观察
  // val 如果没有传值的话，observe(undefined) 会直接返回
  let childOb = !shallow && observe(val)

  // const data = {
  //   // 属性 a 通过 setter/getter 通过闭包引用着 dep 和 childOb
  //   a: {
  //     // 属性 b 通过 setter/getter 通过闭包引用着 dep 和 childOb
  //     b: 1
  //   __ob__: { a, dep, vmCount }
  //   }
  // __ob__: { data, dep, vmCount }
  // }
  // 属性 `a` 闭包引用的 `childOb` 实际上就是 `data.a.__ob__`。
  // 而属性`b` 闭包引用的`childOb` 是`undefined`，因为属性`b` 是基本类型值，并不是对象也不是数组。
  // 为了在访问数据以及写数据的时候能自动执行一些逻辑：getter 做的事情是依赖收集，setter 做的事情是派发更新
  Object.defineProperty(obj, key, {
    // 可枚举
    enumerable: true,
    // 可配置
    configurable: true,
    // 正确地返回属性值， 以及收集依赖
    get: function reactiveGetter() {
      // 如果`getter` 存在那么直接调用该函数，并以该函数的返回值作为属性的值，保证属性的原有读取操作正常运作
      // 执行这个对象上原来就存在的（缓存的 getter）， 否则就返回 val 
      const value = getter ? getter.call(obj) : val
      // Dep.target Dep 是依赖类， 直接挂载在类上的这个 target 属性用于存储数据改变时需要执行的函数
      if (Dep.target) {
        // 每一个数据字段都通过闭包引用着属于自己的 `dep` 常量
        // 依赖收集
        dep.depend()
        // Vue.set 的时候通过 ob.dep.notify() 能够通知到 watcher，从而让添加新的属性到对象也可以检测到变化。
        // 子对象的 __ob__ 被返回了，包含了包含了一个 Dep 实例，其实就是将同一个watcher观察者实例放进了两个depend中，一个是正在本身闭包中的depend，另一个是子元素的depend
        if (childOb) {
          // 而第二个”筐“里收集的依赖的触发时机是在使用 `$set` 或 `Vue.set` 给数据对象添加新属性时触发
          // 在没有 `Proxy` 之前 `Vue` 没办法拦截到给对象添加属性的操作。所以 `Vue` 才提供了 `$set` 和 `Vue.set` 等方法让我们有能力给对象添加新属性的同时触发依赖
          // 只要存在子对象的话，子对象也需要将当前的 Dep.target 当做依赖收集进去
          childOb.dep.depend()
          //  `Observer` 类在定义响应式属性时对于纯对象和数组的处理方式是不同
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    // `set` 函数也要完成两个重要的事情，第一正确地为属性设置新值，第二是能够触发相应的依赖
    set: function reactiveSetter(newVal) {
      // 执行缓存的 getter， 拿到旧值， 与新值进行比较，一致则不需要执行下面的操作
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 原有的值与新的值作比较，并且只有在原有值与新设置的值不相等的情况下才需要触发依赖和重新设置属性值，
      // 否则意味着属性值并没有改变，当然不需要做额外的处理
      // newVal !== newVal && value !== value  =>  NaN === NaN
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // 如果缓存了 setter 函数就执行缓存 setter 函数
      // 如果属性原来拥有自身的 `set` 函数，那么应该继续使用该函数来设置属性的值，从而保证属性原有的设置操作不受影响。
      if (setter) {
        setter.call(obj, newVal)
      } else {
        // TODO: 这里的逻辑还不明确。
        //  val = obj[key]
        val = newVal
      }
      // 新的值需要重新进行observe，保证数据响应式。 这里不管有没有添加属性都执行 observe ，因为如果属性存在 __ob__ 即被观察着的话，反正直接返回的 __ob__ 的
      childOb = !shallow && observe(newVal)
      // dep对象通知所有的观察者。 就是遍历当前依赖的订阅者队列中执行订阅者的 update 函数
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 * 在对象上设置属性。添加新属性，并且如果属性原本是不存在的，那就更改通知机制（也就是多加一个监听器）
 */
// target 值可以为对象或者数组， key 表示新增的属性键名， val 表示新增的属性值
// 换一句话说，能调用 Vue.set 函数的只能是 data 的某一个属性（值为对象或者数组），不能是某个 Vue 实例或者 $data。
// 因为必须保证 target 是有 __ob__ 属性的，所有也不能是一个用户自定义的没有被观察的对象或者数组
export function set(target, key, val) {
  // isUndef 检查是否是 undefined 或者 null
  // isPrimitive 检查是否是原始值
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    // 不能在 undefined null 或者 js 的原始值上设置响应式的属性
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target)}`)
  }

  // 如果 target 是数组且 key 是一个合法的下标，则之前通过 splice 去添加进数组然后返回
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // Math.max(...) 返回一组数里的最大值， 直接修改数组的 length 属性会修改数组的长度（变大扩展）
    target.length = Math.max(target.length, key)
    // 删除已存在 index = key 的属性，并添加一个新的 val 值
    target.splice(key, 1, val)
    return val
  }
  // 如果是一个对象的已经存在的属性，并且这个属性是 hasOwn 的，直接修改值就可以。 因为本来就是响应式的属性。 （将会触发 target 的 set 函数）
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }

  // key 是 target 对象的新属性
  // __ob__ 响应式对象包含的一个属性，是一个 Observer 实例， http://hcysun.me/vue-design/art/7vue-reactive.html#observer-%E6%9E%84%E9%80%A0%E5%87%BD%E6%95%B0
  const ob = target.__ob__
  // _isVue 表明是一个 Vue 实例，不能为 Vue 实例上新添加属性。并且只有根实例 $data 的 __ob__.vmCount 才不是 0
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      // 避免在运行时向 Vue 实例或其根 $data 添加反应性属性——在data选项中预先声明它
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // __ob__ 不存在的话，说明 target 不是一个响应式的对象，则直接赋值并返回。
  if (!ob) {
    target[key] = val
    return val
  }
  // （保证当前的 target 对象是一个响应式的对象）前提下，将新增加的属性声明响应式的
  defineReactive(ob.value, key, val)
  // ob.dep 中存放了若干调用了 target 的属性的订阅者。手动通知值被修改了。
  // 正式因为 target 只能是被观察的对象的某一个属性，所以作为一个  childObj 能被通知更新的前提是依赖被收集了，childObj 的依赖收集是在 get 中的。
  ob.dep.notify()
  return val
}

/**
 * 删除属性并在必要时触发更改
 */
export function del(target, key) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = target.__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  // 通知值被修改了
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    // 如果数组的成员是一个对象，并且已经是响应式了的，那就收集依赖
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
