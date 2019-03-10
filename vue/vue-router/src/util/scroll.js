/* @flow */

import type Router from '../index'
import { assert } from './warn'
import { getStateKey, setStateKey } from './push-state'

const positionStore = Object.create(null)

export function setupScroll() {
  // Fix for #1585 for Firefox
  // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
  // TODO:将 history 中的路由去掉 origin
  window.history.replaceState({ key: getStateKey() }, '', window.location.href.replace(window.location.origin, ''))
  // @note: 当前页面回退等事件触发的时候，会触发 popstate 事件，传出当时存储的 state 值
  // @note: popstate事件只会在浏览器某些行为下触发, 比如点击后退、前进按钮(或者在JavaScript中调用history.back()、history.forward()、history.go()方法).
  window.addEventListener('popstate', e => {
    // @note: 后退、前进的时候需要记录一下当前页面滚动的位置
    saveScrollPosition()
    if (e.state && e.state.key) {
      // TODO: 这是将 _key 设置为之前存储在 stateObj 中的 key （过去某一个点的时间）是为了什么？
      setStateKey(e.state.key)
    }
  })
}

export function handleScroll(
  router: Router,
  to: Route,
  from: Route,
  isPop: boolean
) {
  if (!router.app) {
    return
  }

  const behavior = router.options.scrollBehavior
  if (!behavior) {
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    assert(typeof behavior === 'function', `scrollBehavior must be a function`)
  }

  // wait until re-render finishes before scrolling
  router.app.$nextTick(() => {
    const position = getScrollPosition()
    const shouldScroll = behavior.call(router, to, from, isPop ? position : null)

    if (!shouldScroll) {
      return
    }

    if (typeof shouldScroll.then === 'function') {
      shouldScroll.then(shouldScroll => {
        scrollToPosition((shouldScroll: any), position)
      }).catch(err => {
        if (process.env.NODE_ENV !== 'production') {
          assert(false, err.toString())
        }
      })
    } else {
      scrollToPosition(shouldScroll, position)
    }
  })
}

// @note: 作用是在 positionStore 对象中存储入当前页面的位置信息
export function saveScrollPosition() {
  const key = getStateKey()
  if (key) {
    positionStore[key] = {
      // @note: pageXOffset 和 pageYOffset 属性返回文档在窗口左上角水平和垂直方向滚动的像素。
      // pageXOffset 设置或返回当前页面相对于窗口显示区左上角的 X 位置。pageYOffset 设置或返回当前页面相对于窗口显示区左上角的 Y 位置。
      // pageXOffset 和 pageYOffset 属性相等于 scrollX 和 scrollY 属性。
      x: window.pageXOffset,
      y: window.pageYOffset
    }
  }
}

function getScrollPosition(): ?Object {
  const key = getStateKey()
  if (key) {
    return positionStore[key]
  }
}

function getElementPosition(el: Element, offset: Object): Object {
  const docEl: any = document.documentElement
  const docRect = docEl.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  return {
    x: elRect.left - docRect.left - offset.x,
    y: elRect.top - docRect.top - offset.y
  }
}

function isValidPosition(obj: Object): boolean {
  return isNumber(obj.x) || isNumber(obj.y)
}

function normalizePosition(obj: Object): Object {
  return {
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset
  }
}

function normalizeOffset(obj: Object): Object {
  return {
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0
  }
}

function isNumber(v: any): boolean {
  return typeof v === 'number'
}

function scrollToPosition(shouldScroll, position) {
  const isObject = typeof shouldScroll === 'object'
  if (isObject && typeof shouldScroll.selector === 'string') {
    const el = document.querySelector(shouldScroll.selector)
    if (el) {
      let offset = shouldScroll.offset && typeof shouldScroll.offset === 'object' ? shouldScroll.offset : {}
      offset = normalizeOffset(offset)
      position = getElementPosition(el, offset)
    } else if (isValidPosition(shouldScroll)) {
      position = normalizePosition(shouldScroll)
    }
  } else if (isObject && isValidPosition(shouldScroll)) {
    position = normalizePosition(shouldScroll)
  }

  if (position) {
    window.scrollTo(position.x, position.y)
  }
}
