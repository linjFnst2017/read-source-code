import Vue from 'core/index'
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from '../../../core/instance/lifecycle'
import { devtools, inBrowser, isChrome } from '../../../core/util/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// 覆盖默认导出的 config 对象的属性，安装平台特定的工具方法
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// 为 Vue.options.xxx 扩展上 web 平台专有的指令和组件
// 添加了两个指令(vue 默认存在的两个指令): model, show
extend(Vue.options.directives, platformDirectives)
// 添加了两个组件(专场动画):   Transition, TransitionGroup
extend(Vue.options.components, platformComponents)

// 在 Vue.prototype 上添加 __patch__ 方法，如果在浏览器环境运行的话，这个方法的值为 patch 函数，
// 否则是一个空函数 noop， 比如 weex 平台，等待重写 __patch__ 函数。甚至在 web 平台上，是否是服务端渲染也会对这个方法产生影响。
// 因为在服务端渲染中，没有真实的浏览器 DOM 环境，所以不需要把 VNode 最终转换成 DOM，因此是一个空函数
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
// 公共的挂载函数
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  // mountComponent 最终返回的是一个 vm 实例，顾名思义，挂载一个组件，那么就需要将整个组件的依赖收集一下，
  // new Watcher 的时候主要是将从虚拟 dom 转化成真实 dom 的函数定义到依赖变化之后的回调中了，即每次 data 变化都会通知依赖执行从虚拟 dom 到真实 dom 的任务
  return mountComponent(this, el, hydrating)
}

// devtools global hook
// vuex 开发者工具
/* istanbul ignore next */
if (inBrowser) {
  setTimeout(() => {
    // 默认在非生产环境下是开启状态的
    if (config.devtools) {
      // window.__VUE_DEVTOOLS_GLOBAL_HOOK__
      if (devtools) {
        // 初始化开发者工具，但是 __VUE_DEVTOOLS_GLOBAL_HOOK__ 这个对象的值是什么时候被赋予的？
        // 貌似是 chrome 的插件往页面 window.__VUE_DEVTOOLS_GLOBAL_HOOK__ 中注入了值
        devtools.emit('init', Vue)
      } else if (
        process.env.NODE_ENV !== 'production' &&
        process.env.NODE_ENV !== 'test' &&
        isChrome
      ) {
        console[console.info ? 'info' : 'log'](
          'Download the Vue Devtools extension for a better development experience:\n' +
          'https://github.com/vuejs/vue-devtools'
        )
      }
    }
    // 打印 vue 产品标志
    if (process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test' &&
      config.productionTip !== false &&
      typeof console !== 'undefined'
    ) {
      console[console.info ? 'info' : 'log'](
        `You are running Vue in development mode.\n` +
        `Make sure to turn on production mode when deploying for production.\n` +
        `See more tips at https://vuejs.org/guide/deployment.html`
      )
    }
  }, 0)
}

export default Vue
