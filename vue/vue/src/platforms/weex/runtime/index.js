/* @flow */

import Vue from 'core/index'
import { patch } from 'weex/runtime/patch'
import { mountComponent } from 'core/instance/lifecycle'
import platformDirectives from 'weex/runtime/directives/index'
import platformComponents from 'weex/runtime/components/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isRuntimeComponent,
  isUnknownElement
} from 'weex/util/element'

// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isRuntimeComponent = isRuntimeComponent
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives and components
Vue.options.directives = platformDirectives
Vue.options.components = platformComponents

// install platform patch function
Vue.prototype.__patch__ = patch

// wrap mount
// 运行时版 Vue 的 $mount 函数的功能
Vue.prototype.$mount = function (
  el?: any, // string | Element el 可以是一个字符串也可以是一个 dom 节点
  hydrating?: boolean // 虚拟 dom 的补丁算法标识
): Component {
  return mountComponent(
    this,
    el && query(el, this.$document),
    hydrating
  )
}

export default Vue
