/* @flow */

import { isIE, isIE9, isEdge } from 'core/util/env'

import {
  extend,
  isDef,
  isUndef
} from 'shared/util'

import {
  isXlink,
  xlinkNS,
  getXlinkProp,
  isBooleanAttr,
  isEnumeratedAttr,
  isFalsyAttrValue
} from 'web/util/index'

// 更新属性
function updateAttrs(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  // componentOptions 创建 vnode 的时候传的参数，有可能没传为 undefined
  const opts = vnode.componentOptions
  // TODO: inheritAttrs 继承属性
  if (isDef(opts) && opts.Ctor.options.inheritAttrs === false) {
    return
  }
  // TODO: oldVnode.data.attrs
  if (isUndef(oldVnode.data.attrs) && isUndef(vnode.data.attrs)) {
    return
  }
  let key, cur, old
  // TODO: 
  // vnode.elm ? vm.$el ?
  const elm = vnode.elm
  const oldAttrs = oldVnode.data.attrs || {}
  let attrs: any = vnode.data.attrs || {}
  // clone observed objects, as the user probably wants to mutate it
  // 克隆观察的对象，因为用户可能希望对其进行修改
  if (isDef(attrs.__ob__)) {
    // extend 应该是不会复制出 __ob__ 因为这个 __ob__ 属性不可枚举
    attrs = vnode.data.attrs = extend({}, attrs)
  }

  for (key in attrs) {
    cur = attrs[key]
    old = oldAttrs[key]
    if (old !== cur) {
      setAttr(elm, key, cur)
    }
  }
  // #4391: in IE9, setting type can reset value for input[type=radio]
  // #6666: IE/Edge forces progress value down to 1 before setting a max
  /* istanbul ignore if */
  if ((isIE || isEdge) && attrs.value !== oldAttrs.value) {
    setAttr(elm, 'value', attrs.value)
  }
  for (key in oldAttrs) {
    if (isUndef(attrs[key])) {
      if (isXlink(key)) {
        elm.removeAttributeNS(xlinkNS, getXlinkProp(key))
      } else if (!isEnumeratedAttr(key)) {
        elm.removeAttribute(key)
      }
    }
  }
}

function setAttr(el: Element, key: string, value: any) {
  if (el.tagName.indexOf('-') > -1) {
    baseSetAttr(el, key, value)
  } else if (isBooleanAttr(key)) {
    // set attribute for blank value
    // e.g. <option disabled>Select one</option>
    if (isFalsyAttrValue(value)) {
      el.removeAttribute(key)
    } else {
      // technically allowfullscreen is a boolean attribute for <iframe>,
      // but Flash expects a value of "true" when used on <embed> tag
      value = key === 'allowfullscreen' && el.tagName === 'EMBED'
        ? 'true'
        : key
      el.setAttribute(key, value)
    }
  } else if (isEnumeratedAttr(key)) {
    el.setAttribute(key, isFalsyAttrValue(value) || value === 'false' ? 'false' : 'true')
  } else if (isXlink(key)) {
    if (isFalsyAttrValue(value)) {
      el.removeAttributeNS(xlinkNS, getXlinkProp(key))
    } else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  } else {
    baseSetAttr(el, key, value)
  }
}

function baseSetAttr(el, key, value) {
  if (isFalsyAttrValue(value)) {
    el.removeAttribute(key)
  } else {
    // #7138: IE10 & 11 fires input event when setting placeholder on
    // <textarea>... block the first input event and remove the blocker
    // immediately.
    /* istanbul ignore if */
    if (
      isIE && !isIE9 &&
      el.tagName === 'TEXTAREA' &&
      key === 'placeholder' && !el.__ieph
    ) {
      const blocker = e => {
        e.stopImmediatePropagation()
        el.removeEventListener('input', blocker)
      }
      el.addEventListener('input', blocker)
      // $flow-disable-line
      el.__ieph = true /* IE placeholder patched */
    }
    el.setAttribute(key, value)
  }
}

export default {
  create: updateAttrs,
  update: updateAttrs
}
