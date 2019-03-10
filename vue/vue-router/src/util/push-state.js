/* @flow */

/**
 * 理论上来说，这个也正是 vue-router 在实际使用 history 模式时不能按照正常的 nginx 去配置，因为实际的路由并不存在，页面也不会去检测。
 * https://cli.vuejs.org/zh/guide/deployment.html#%E4%BD%BF%E7%94%A8-history-pushstate-%E7%9A%84%E8%B7%AF%E7%94%B1
 * 
 * pushState replaceState 以及 popstate 事件：
 * 
 * popstate: 
 * 当活动历史记录条目更改时，将触发popstate事件。如果被激活的历史记录条目是通过对history.pushState（）的调用创建的，
 * 或者受到对history.replaceState（）的调用的影响，popstate事件的state属性包含历史条目的状态对象的副本。
 * 
 * 需要注意的是调用history.pushState()或history.replaceState()不会触发popstate事件。只有在做出浏览器动作时，才会触发该事件，
 * 如用户点击浏览器的回退按钮（或者在Javascript代码中调用history.back()）
 * 
 * history.state:
 * 当前URL下对应的状态信息。如果当前URL不是通过pushState或者replaceState产生的，那么history.state是null。
 * 
 * history.pushState(state, title, url):
 * 将当前URL和history.state加入到history中，并用新的state和URL替换当前。不会造成页面刷新
 * 
 * history.replaceState:
 * 用新的state和URL替换当前。不会造成页面刷新。
 */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'

export const supportsPushState = inBrowser && (function () {
  const ua = window.navigator.userAgent
  // 判断低版本的的一些安卓浏览器， ios 手机端也不支持 PushState
  if (
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Windows Phone') === -1
  ) {
    return false
  }

  return window.history && 'pushState' in window.history
})()

// TODO: window.performance 一般用于检测性能 
// TODO:  window.performance.now?
// use User Timing api (if present) for more accurate key precision
const Time = inBrowser && window.performance && window.performance.now
  ? window.performance
  : Date

let _key: string = genKey()

function genKey(): string {
  return Time.now().toFixed(3)
}

export function getStateKey() {
  return _key
}

export function setStateKey(key: string) {
  _key = key
}

export function pushState(url?: string, replace?: boolean) {
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    if (replace) {
      history.replaceState({ key: _key }, '', url)
    } else {
      _key = genKey()
      history.pushState({ key: _key }, '', url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

export function replaceState(url?: string) {
  pushState(url, true)
}
