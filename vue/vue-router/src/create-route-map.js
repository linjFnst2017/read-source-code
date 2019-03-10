/* @flow */
// 该工具库用来处理 url 中地址与参数，能够很方便得到我们想要的数据
// https://www.jianshu.com/p/7d2dbfdd1b0f
import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

// 被 createMatcher 函数调用的时候，只传递过来一个参数 routes， 是一个数组
export function createRouteMap(
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>;
  pathMap: Dictionary<RouteRecord>;
  nameMap: Dictionary<RouteRecord>;
} {
  // the path list is used to control path matching priority
  // 路径列表用于控制路径匹配优先级
  const pathList: Array<string> = oldPathList || []
  // 这里的 oldPathMap 和 oldNameMap 都没有被传参，因此都是 undefined， TODO: 因此这里的 pathMap 和 nameMap 值都是一个没有上端原型链的对象 ？
  // $flow-disable-line
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  // TODO:
  routes.forEach(route => {
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  // 确保通配符路由始终在最后
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

function addRouteRecord(
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,
  matchAs?: string
) {
  // path 是 route 的访问路径， name 可以理解为是 路由的别名
  const { path, name } = route
  if (process.env.NODE_ENV !== 'production') {
    // 没有指定实际的 path 路径，就报错
    // TODO: 可以尝试一下，取其中一个 route 不给实际的 path 值，看一看是不是这个报错。
    assert(path != null, `"path" is required in a route configuration.`)
    // component 值不能是一个字符串
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(path || name)} cannot be a ` +
      `string id. Use an actual component instead.`
    )
  }

  // pathToRegexpOptions 一般项目不一定会给找一个属性，因此这里暂时可以理解为是一个 空对象
  const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}
  // addRouteRecord 函数有多处被调用，分以下几种情况：
  // 1. routes.forEach 中调用 addRouteRecord 时， 并没有传入 parent ， pathToRegexpOptions 也是一个空对象， 这里基本上返回的就是 path 本身
  const normalizedPath = normalizePath(
    path,
    parent,
    pathToRegexpOptions.strict
  )
  // caseSensitive 一般项目不一定会给找一个属性，
  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  const record: RouteRecord = {
    // 经过标准化的路由
    path: normalizedPath,
    // TODO: 
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    // TODO: 不知道这个是否是取决于 打包模块不同的问题
    components: route.components || { default: route.component },
    instances: {},
    name,
    parent,
    matchAs,
    // 重定向地址
    redirect: route.redirect,
    // 路由进入之前需要做的事情
    beforeEnter: route.beforeEnter,
    // TODO: management 项目里面好像是需要手动添加 一个 vue-meta 组件的
    meta: route.meta || {},
    // TODO:
    props: route.props == null
      ? {}
      : route.components
        ? route.props
        : { default: route.props }
  }

  // TODO:
  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    if (process.env.NODE_ENV !== 'production') {
      if (route.name && !route.redirect && route.children.some(child => /^\/?$/.test(child.path))) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
          `When navigating to this named route (:to="{name: '${route.name}'"), ` +
          `the default child route will not be rendered. Remove the name from ` +
          `this route and use the name of the default child route for named ` +
          `links instead.`
        )
      }
    }
    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  // TODO:
  // alias
  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias)
      ? route.alias
      : [route.alias]

    aliases.forEach(alias => {
      const aliasRoute = {
        path: alias,
        children: route.children
      }
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      )
    })
  }

  if (!pathMap[record.path]) {
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
        `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

function compileRouteRegex(path: string, pathToRegexpOptions: PathToRegexpOptions): RouteRegExp {
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      warn(!keys[key.name], `Duplicate param keys in route with path: "${path}"`)
      keys[key.name] = true
    })
  }
  return regex
}

function normalizePath(path: string, parent?: RouteRecord, strict?: boolean): string {
  // 如果没有设置 strict 的话，将所有以 “/” 结尾的路由，都去掉 “/”
  if (!strict) path = path.replace(/\/$/, '')
  // path 这个字符串，如果是以 “/” 开头的话，直接返回 path 本身
  if (path[0] === '/') return path
  // 没有父路由的话，也直接返回 path 本身
  // TODO: 不过这里的意思是, path 可以不以 “/” 开头？
  if (parent == null) return path
  // cleanPath 的作用是替换字符串中的连续两个 “//” 为一个 “/”, 原因是在这里， 父路由的 path 与 子 path 相加的过程中容易产生连续两个 “//”
  return cleanPath(`${parent.path}/${path}`)
}
