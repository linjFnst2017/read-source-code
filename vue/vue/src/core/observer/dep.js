/* @flow */
// 发布者
import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * dep是一个可观察的对象，可以有多个指令订阅它
 * Dep 实际上就是对 Watcher 的一种管理，Dep 脱离 Watcher 单独存在是没有意义的
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor() {
    this.id = uid++
    // subs 是 Watcher 的数组。
    this.subs = []
  }

  addSub(sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub(sub: Watcher) {
    remove(this.subs, sub)
  }

  depend() {
    // 静态 target 对象。 依赖收集是收集到 target 上的，也就是当前自身 new 出来的一个 watcher 上
    // Dep.target 值是一个 watcher ，是 dep 实例的储存容器（数组）
    if (Dep.target) {
      // 可以理解为当前依赖收集是哪一个订阅者的 getter 函数执行而触发的，Dep.target 的值就是哪一个订阅者
      // 也就是说，一个订阅者被实例化或者主动执行 evaluate 函数的订阅者，首先会将 Object.defineProperty 函数闭包中的 dep 添加到
      // 自身的 newDepIds 和 newDeps 中（如果已经有了那就不添加了），简单说就是在订阅者中记录依赖了哪一个值。紧接着，这个 dep 会将当前
      // 的订阅者加入到订阅者队列 subs 中，用于之后 set 函数中通知依赖当前这个属性的所有订阅者。
      Dep.target.addDep(this)
    }
  }

  // 通知所有订阅者
  notify() {
    // 首先更新 ？订阅者列表
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    // 遍历所有的 subs, 每一个 watcher 都需要执行 update()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
// TODO: 但是这里并不是用完之后才设置为 null 的吧。。。
// 依赖收集完需要将Dep.target设为null，防止后面重复添加依赖。
// 静态属性 target，这是一个全局唯一 Watcher。在同一时间只能有一个全局的 Watcher 被计算。
Dep.target = null
const targetStack = []

export function pushTarget(_target: ?Watcher) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

export function popTarget() {
  Dep.target = targetStack.pop()
}
