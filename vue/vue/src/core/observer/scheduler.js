/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState() {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue() {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  // 获取到 updatedQueue，调用 update 的钩子函数
  // updatedQueue 是 更新了的 wathcer 数组
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks(queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    // 对这些数组做遍历，只有满足当前 watcher 为 vm._watcher 以及组件已经 mounted 这两个条件，才会执行 updated 钩子函数
    if (vm._watcher === watcher && vm._isMounted) {
      // 只有 vm._watcher 的回调执行完毕后，才会执行 updated 钩子函数。
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent(vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks(queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * 将一个 watcher 推入 watcher 队列。
 * 具有重复id的 任务 将被跳过，除非在刷新队列时推送它。
 * 引入了一个队列的概念, 是 Vue 在做派发更新的时候的一个优化的点，它并不会每次数据改变都触发 watcher 的回调，
 * 而是把这些 watcher 先添加到一个队列里，然后在 nextTick 后执行 flushSchedulerQueue
 */
export function queueWatcher(watcher) {
  // 获取watcher的id
  const id = watcher.id
  // undefined == null
  // has 是一个全局对象 用作 map
  // 检验id是否存在，已经存在则直接跳过，不存在则标记哈希表has，用于下次检验
  if (has[id] == null) {
    has[id] = true
    // 正在刷新
    if (!flushing) {
      // 如果没有flush掉，直接push到队列中即可
      queue.push(watcher)
    } else {
      // 如果已经刷新，则根据其id拼接监视程序
      // if already flushing, splice the watcher based on its id
      // 如果已经超过了它的id，它将立即运行
      // if already past its id, it will be run next immediately.
      // TODO: 
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    // waiting 默认 false
    // waiting 保证对 nextTick(flushSchedulerQueue) 的调用逻辑只有一次
    if (!waiting) {
      waiting = true

      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      // 对于 watcher 按照一定额规则进行排序之后在进行渲染，因为需要满足首先渲染父组件、再渲染子组件，不然父组件渲染完成之后 子组件又需要经历重新渲染
      nextTick(flushSchedulerQueue)
    }
  }
}
