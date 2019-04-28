/* @flow */
/* globals MessageChannel */

// 数据的变化到 DOM 的重新渲染是一个异步过程，发生在下一个 tick
// https://ustbhuangyi.github.io/vue-analysis/reactive/next-tick.html#js-%E8%BF%90%E8%A1%8C%E6%9C%BA%E5%88%B6
// Vue 在内部对异步队列尝试使用原生的 Promise.then 和 MessageChannel，如果执行环境不支持，则会采用 setTimeout(fn, 0) 代替。
import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

const callbacks = []
let pending = false

// 刷新（执行）事件队列中的所有回调函数
function flushCallbacks() {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).

// js 事件循环： js 是单线程执行的，所有的同步任务都在主进程上执行，形成一个执行栈；而所有的异步任务有了结果之后，都是被推入一个任务队列中
// 所有主进程中的任务都执行完毕之后，js 就会去查看任务队列中是否存在能够执行的事件，往复循环。
// 而主进程的执行过程就称为一个 tick。 而所有异步任务都是通过“任务队列”来调度的，任务队列中的 task 主要分为两种类型， macro task 和 micro task
// 并且每个 macro task 结束后，都要清空所有的 micro task。
// 在浏览器环境中，常见的 macro task 有 setTimeout、MessageChannel、postMessage、setImmediate；常见的 micro task 有 MutationObsever 和 Promise.then。
// 声明了 microTimerFunc 和 macroTimerFunc 2 个变量，它们分别对应的是 micro task 的函数和 macro task 的函数
let microTimerFunc
let macroTimerFunc
let useMacroTask = false

// Determine (macro) task defer implementation.
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
/* istanbul ignore if */

// setImmediate()是将事件插入到事件队列尾部，主线程和事件队列的函数执行完成之后立即执行 setImmediate 指定的回调函数
// 检验是否是原生的 setImmediate 函数
// 对于 macro task 的实现，优先检测是否支持原生 setImmediate，这是一个高版本 IE 和 Edge 才支持的特性，
// 不支持的话再去检测是否支持原生的 MessageChannel，如果也不支持的话就会降级为 setTimeout 0
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else if (typeof MessageChannel !== 'undefined' && (
  // https://www.jianshu.com/p/4f07ef18b5d7
  isNative(MessageChannel) ||
  // PhantomJS
  MessageChannel.toString() === '[object MessageChannelConstructor]'
)) {
  const channel = new MessageChannel()
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)
  }
} else {
  /* istanbul ignore next */
  macroTimerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// Determine microtask defer implementation.
/* istanbul ignore next, $flow-disable-line */
// 使用原生的 promise 执行，保证执行顺序
// 对于 micro task 的实现，则检测浏览器是否原生支持 Promise，不支持的话直接指向 macro task 的实现
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  microTimerFunc = () => {
    p.then(flushCallbacks)
    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
} else {
  // fallback to macro
  // 直接指向 macro task 的执行方式
  microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 * 对函数做一层包装，确保函数执行过程中对数据任意的修改，触发变化执行 nextTick 的时候强制走 macroTimerFunc。比如对于一些 DOM 交互事件，
 * 如 v-on 绑定的事件回调函数的处理，会强制走 macro task。
 */
export function withMacroTask(fn: Function): Function {
  return fn._withTask || (fn._withTask = function () {
    useMacroTask = true
    const res = fn.apply(null, arguments)
    useMacroTask = false
    return res
  })
}

// ctx 执行上下文： Vue 实例
// 执行的目的是在 microtask 或者 task 中推入一个function，在当前栈执行完毕（也许还会有一些排在前面的需要执行的任务）以后执行nextTick传入的function
// 目的是延迟到当前调用栈执行完以后执行
export function nextTick(cb?: Function, ctx?: Object) {
  // 使用 callbacks 而不是直接在 nextTick 中执行回调函数的原因是保证在同一个 tick 内多次执行 nextTick，
  // 不会开启多个异步任务，而把这些异步任务都压成一个同步任务，在下一个 tick 执行完毕。
  let _resolve
  // 存放异步执行的回调， 一开始是空数组。 push 入一个回调函数
  callbacks.push(() => {
    if (cb) {
      // 指定上下文
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
      // TODO:
      // _resolve 定义的时候没有赋值， 这里的条件判断什么时候会被执行？
    } else if (_resolve) {
      _resolve(ctx)
    }
  })

  // 准备中
  if (!pending) {
    pending = true
    // 根据 useMacroTask 条件执行 macroTimerFunc 或者是 microTimerFunc
    // 而 macroTimerFunc 和 microTimerFunc 都会在下一个 tick 中将上面压入的 cb 执行完
    if (useMacroTask) {
      macroTimerFunc()
    } else {
      microTimerFunc()
    }
  }

  // $flow-disable-line
  // 当 nextTick 不传 cb 参数的时候，提供一个 Promise 化的调用，
  // nextTick().then(() => {})
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      // 当 _resolve 函数执行，就会跳到 then 的逻辑中
      _resolve = resolve
    })
  }

}
