/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents(vm: Component) {
  // TODO:
  // 这里去看一下 原型链上的属性 和 用字面量创建的属性有什么区别？
  // 这里应该是只有调用了
  // 初始化事件对象，值是 回调函数 的集合
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add(event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

function remove(event, fn) {
  target.$off(event, fn)
}

export function updateComponentListeners(
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
  target = undefined
}

export function eventsMixin(Vue) {
  const hookRE = /^hook:/

  // 监听当前实例上的自定义事件。事件可以由vm.$emit触发。回调函数会接收所有传入事件触发函数的额外参数。
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    // 如果event 传递了一个数组（数组的元素都是 string），就自动将所有的事件都调用 $on 注册事件监听器
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      // 先进行判断 vm._events[event] 是否为空，为空则将 vm._events[event] 设置为空数组，接着 push 一个回调
      // 如果 vm._events[event] 本身不为空，直接 push 回调

      // 这里其实蛮奇怪的，为什么将回调函数放在数组中？ 数组中也只有一个 fn 啊，想了想， 如果是对象，还需要一个键名；
      // 因为一个事件名， 可以被多次注册回调，那就只能是数组了。
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // 通过使用一个 Boolean 的 flag 来标记是否注册了 事件，而非hash 查找，来优化 (? 查找)钩子事件的话费
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      // TODO:
      // event: string 如果带有 hook 的话，表示钩子事件？
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  // 监听一个自定义事件，但是只触发一次，在第一次触发之后移除监听器。
  // TODO:
  // $once 能够传 event 数组么？
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on() {
      // 执行 event 事件的回调函数的第一件事就是 移除event事件监听器
      // 如果回调 函数执行报错，不会导致最终没有移除事件监听器
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    // TODO:
    // 为啥需要给 on 函数在添加一个 fn 属性呢？
    on.fn = fn
    // 注册 event 事件
    vm.$on(event, on)
    return vm
  }

  // 移除自定义事件监听器。
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    // $off 函数没有参数， event = undefined ， fn = undefined 就将vm._events 置空
    // 并且这个 vm._events 对象不含有原型链
    // TODO:
    // Object.create(null) 为什么要创建没有原型链的一个对象， {} 不行？
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event]
    // 如果本身 vm._events[event] 就不含事件回调，就直接返回实例
    if (!cbs) {
      return vm
    }
    // 如果只提供了事件， fn = undefined， 则将移除该事件的所有监听器
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // 如果同时提供了事件与回调，
    if (fn) {
      // specific handler
      let cb
      let i = cbs.length
      // 事件对应了多个回调函数
      while (i--) {
        cb = cbs[i]
        // TODO:
        // 不懂为什么 要用 cb.fn ?
        if (cb === fn || cb.fn === fn) {
          cbs.splice(i, 1)
          break
        }
      }
    }
    return vm
  }

  // 触发当前实例上的事件。附加参数都会传给监听器回调。
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      // toLowerCase() 将字符串转化为全部的小写
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          // TODO:
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          // TODO:
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      // TODO:
      // cbs 本来就应该是一个数组才对啊，为什么还需要使用 toArray() 转化
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // arguments 对象并不是一个数组(是一个类数组的对象，键名为0,1,2,3...)， 但是访问单个参数的方式与访问数组元素的方式相同
      const args = toArray(arguments, 1)
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          // 依次执行注册的回调函数（可能有多个）
          cbs[i].apply(vm, args)
        } catch (e) {
          // TODO:
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
