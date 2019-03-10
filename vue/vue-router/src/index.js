/* @flow */

import { install } from './install'
import { START } from './util/route'
import { assert } from './util/warn'
import { inBrowser } from './util/dom'
import { cleanPath } from './util/path'
import { createMatcher } from './create-matcher'
import { normalizeLocation } from './util/location'
import { supportsPushState } from './util/push-state'

import { HashHistory } from './history/hash'
import { HTML5History } from './history/html5'
import { AbstractHistory } from './history/abstract'

import type { Matcher } from './create-matcher'

export default class VueRouter {
  // 函数前面添加一个static关键字，表明这是一个静态方法，不会被实例继承，只能通过类来调用
  static install: () => void;
  static version: string;

  app: any;
  apps: Array<any>;
  ready: boolean;
  readyCbs: Array<Function>;
  options: RouterOptions;
  mode: string;
  history: HashHistory | HTML5History | AbstractHistory;
  matcher: Matcher;
  fallback: boolean;
  beforeHooks: Array<?NavigationGuard>;
  resolveHooks: Array<?NavigationGuard>;
  afterHooks: Array<?AfterNavigationHook>;

  constructor(options: RouterOptions = {}) {
    this.app = null
    this.apps = []
    // 初始化 vueRouter 时需要传入的参数，一般是 base, mode , routes 路由规则和需要加载的组件
    this.options = options
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []
    // 匹配器， 内容是两个函数： match 和 addRoutes
    this.matcher = createMatcher(options.routes || [], this)

    let mode = options.mode || 'hash'
    // 可回退。 options.fallback 一般是不给的，
    // 这里应该是 vue-router 为浏览器做的降级处理，如果用户设置了 mode 是 history， 但是浏览器并不支持 pushState，并且开发者也没有手动进行设置 fallback （表明不可回退？）的话，
    // vue-router 将强行转化为 hash 模式处理。需要注意的是 history 模式下，nginx 配置需要将任何没有匹配到静态文件的请求回退到 index.html。
    this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
    if (this.fallback) {
      mode = 'hash'
    }
    // TODO: 如果不是在 浏览器中，是指 nuxtjs 中？
    if (!inBrowser) {
      mode = 'abstract'
    }
    this.mode = mode

    // 通过 mode 值来进行初始化 history 值，默认值是 hash mode
    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${mode}`)
        }
    }
  }

  match(
    raw: RawLocation,
    current?: Route,
    redirectedFrom?: Location
  ): Route {
    return this.matcher.match(raw, current, redirectedFrom)
  }

  // 当前路线 route 表示单次的一个路由， 而 routers 表示一个路由器（多个路由的合集），用户操作路由的方法
  get currentRoute(): ?Route {
    return this.history && this.history.current
  }

  init(app: any /* Vue component instance */) {
    // 避免多次调用 init 函数
    process.env.NODE_ENV !== 'production' && assert(
      install.installed,
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )

    this.apps.push(app)

    // main app already initialized.
    if (this.app) {
      return
    }

    this.app = app

    const history = this.history

    if (history instanceof HTML5History) {
      history.transitionTo(history.getCurrentLocation())
    } else if (history instanceof HashHistory) {
      const setupHashListener = () => {
        history.setupListeners()
      }
      history.transitionTo(
        history.getCurrentLocation(),
        setupHashListener,
        setupHashListener
      )
    }

    history.listen(route => {
      this.apps.forEach((app) => {
        app._route = route
      })
    })
  }

  // 下面这里的都是 router 的实例方法， 通常如果是 vue-cli 初始化的项目，会在 main.js 中编写这些全局守卫
  beforeEach(fn: Function): Function {
    return registerHook(this.beforeHooks, fn)
  }

  beforeResolve(fn: Function): Function {
    return registerHook(this.resolveHooks, fn)
  }

  afterEach(fn: Function): Function {
    return registerHook(this.afterHooks, fn)
  }

  onReady(cb: Function, errorCb?: Function) {
    this.history.onReady(cb, errorCb)
  }

  onError(errorCb: Function) {
    this.history.onError(errorCb)
  }

  // 
  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.push(location, onComplete, onAbort)
  }

  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.replace(location, onComplete, onAbort)
  }

  go(n: number) {
    this.history.go(n)
  }

  // 后退
  back() {
    this.go(-1)
  }
  // 前进
  forward() {
    this.go(1)
  }

  getMatchedComponents(to?: RawLocation | Route): Array<any> {
    const route: any = to
      ? to.matched
        ? to
        : this.resolve(to).route
      : this.currentRoute
    if (!route) {
      return []
    }
    return [].concat.apply([], route.matched.map(m => {
      return Object.keys(m.components).map(key => {
        return m.components[key]
      })
    }))
  }

  // to 是一个必要参数
  resolve(
    to: RawLocation,
    current?: Route,
    append?: boolean
  ): {
    location: Location,
    route: Route,
    href: string,
    // for backwards compat
    normalizedTo: Location,
    resolved: Route
  } {
    const location = normalizeLocation(
      to,
      current || this.history.current,
      append,
      this
    )
    const route = this.match(location, current)
    const fullPath = route.redirectedFrom || route.fullPath
    const base = this.history.base
    const href = createHref(base, fullPath, this.mode)
    return {
      location,
      route,
      href,
      // for backwards compat
      normalizedTo: location,
      resolved: route
    }
  }

  addRoutes(routes: Array<RouteConfig>) {
    this.matcher.addRoutes(routes)
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

function registerHook(list: Array<any>, fn: Function): Function {
  list.push(fn)
  return () => {
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}

// 根据初始化 VueRouter 的时候传入的 mode 和 base , 为 path 自动添加上 base 或者 # 
function createHref(base: string, fullPath: string, mode) {
  var path = mode === 'hash' ? '#' + fullPath : fullPath
  return base ? cleanPath(base + '/' + path) : path
}


// ======= 这一部分的内容，感觉应该是直接以 vue-router.[min].js 引入 index.html 中的时候自动调用的，肯定需要注意引入 js 的顺序， vue.js 在前，vue-router.js 在后
// 在类上挂在一个 install 函数。。。。 TODO: emmmm 看一下是在哪里进行调用的
VueRouter.install = install
// TODO: 为什么我老感觉 version 这里只有一个字符串，但是没有具体的版本号数字？
VueRouter.version = '__VERSION__'

// 自动注册 VueRouter
if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter)
}
