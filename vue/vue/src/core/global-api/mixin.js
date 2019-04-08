/* @flow */

import { mergeOptions } from '../util/index'

// 在 Vue 上添加 mixin 这个全局API
export function initMixin(Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // TODO: this 的指向会不会有问题？
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
