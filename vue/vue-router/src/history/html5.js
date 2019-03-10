/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { START } from '../util/route'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HTML5History extends History {
  constructor(router: Router, base: ?string) {
    super(router, base)
    // TODO:
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll
    // @note: 如果浏览器支持滚动的话，当前这里的前提是浏览器也支持 pushState， 就初始化 滚动事件？ 
    if (supportsScroll) {
      setupScroll()
    }

    const initLocation = getLocation(this.base)
    window.addEventListener('popstate', e => {
      const current = this.current

      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      const location = getLocation(this.base)
      if (this.current === START && location === initLocation) {
        return
      }

      this.transitionTo(location, route => {
        if (supportsScroll) {
          handleScroll(router, route, current, true)
        }
      })
    })
  }

  go(n: number) {
    window.history.go(n)
  }

  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      pushState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      replaceState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  ensureURL(push?: boolean) {
    if (getLocation(this.base) !== this.current.fullPath) {
      const current = cleanPath(this.base + this.current.fullPath)
      push ? pushState(current) : replaceState(current)
    }
  }

  getCurrentLocation(): string {
    return getLocation(this.base)
  }
}

export function getLocation(base: string): string {
  // @note: 转码 encodeURI 函数的结果
  // url: "https://developer.mozilla.org/zh-CN/docs/Web/Events/popstate"
  // origin: "https://developer.mozilla.org"
  // pathname: "/zh-CN/docs/Web/Events/popstate"
  let path = decodeURI(window.location.pathname)
  if (base && path.indexOf(base) === 0) {
    // TODO: 这里为什么需要将 path 中的 base 部分去掉 ？
    path = path.slice(base.length)
  }
  // @note: path 不存在的是属于当前页面是 "" , 不包含 "/"
  return (path || '/') + window.location.search + window.location.hash
}
