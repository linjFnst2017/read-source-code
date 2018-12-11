import Module from './module'
import { assert, forEachValue } from '../util'

// raw 未加工的
export default class ModuleCollection {
  constructor(rawRootModule) {
    // register root module (Vuex.Store options)
    // 传参是 “未加工的根模块”
    // todo: 为啥直接给了一个空数组
    this.register([], rawRootModule, false)
  }

  // 从 reduce 看出，这里的path 应该就一定是一个数组了。。，字符串不可能的含有 reduce 函数
  // todo: 话说这里为什么进行判断？ path 是否是一个数组？
  get(path) {
    // todo: 这里的 reduce 应该跟 foreach 类似吧
    // 一开始 this.root === undefind 作为一个初始值
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)

    // todo: 这里使用 foreach 该如何实现 reduce 的功能？
    // let resp = undefined
    // path.forEach((module, key) => {
    //   resp = resp && resp.getChild(key)

    // })
  }

  // todo: path 具体的值不会是， ['user', 'xiaoming', 'haha'] 对应到 user 模块的 xiaoming 模块的 haha 模块？
  // 所以感觉基本上 path 为含一个元素的数组比较多，但是也支持深度的 module， 就是用的比较少 ？
  getNamespace(path) {
    let module = this.root
    // key 值举例应该是 module name , 比如  user robot 等
    return path.reduce((namespace, key) => {
      // 获取每一个 child 的具体内容， 就是子模块， module
      module = module.getChild(key)
      // 如果 namespaced = false 就不能在使用 helpers 函数的时候使用 namespace 了
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  // collection 的 update 
  update(rawRootModule) {
    update([], this.root, rawRootModule)
  }

  register(path, rawModule, runtime = true) {
    if (process.env.NODE_ENV !== 'production') {
      // 在开发模式下，校验  getters mutations 以及 actions 是否符合规范
      // todo: path 这里代码啥意义？ 
      // rawModule 未加工的模块，每一个 module 模块都会有 getters mutations 等信息
      assertRawModule(path, rawModule)
    }

    // 一个 module 拥有的几个属性:
    // runtime: 暂时不知道是干嘛的
    // _children: 子模块
    // _rawModule: 为进行加工的模块，里面包含了 state getters namespaced等等。
    // state: 值跟 _rawModule.state 是一样的。
    // 可以理解为，new Module() 是为了加工模块？ 分离出 state , 标志 runtime 等属性 ？
    const newModule = new Module(rawModule, runtime)
    if (path.length === 0) {
      // [] 的这种情况，rawModule 经过加工之后赋值给 根节点
      this.root = newModule
    } else {
      // todo: path 不等于 [] 的情况到底属于哪一种？
      // todo: 貌似也不是很明白，这里
      // path.slice(0, -1) slice函数 用于 string 或者 array， 第二个参数表示到哪里位置，负数则从最后往前数，这样就不用 先获取 length - num 来截取了！
      const parent = this.get(path.slice(0, -1))
      // todo: 为啥这里使用 下标，还用 path.length - 1 的方式声明 key ？ 看起来有点 low
      // 给 _children 添加一个属性，key 为 path.length - 1 ， 感觉有点奇怪
      parent.addChild(path[path.length - 1], newModule)
    }

    // register nested modules
    // 注册模块的内建模块（子模块就是嵌套的子模块）
    if (rawModule.modules) {
      // key, rawChildModule 属于 rawModule.modules 子模块的键值（新的 getters, mutations ...）
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }

  unregister(path) {
    // todo: parent 怎么是这么取值？ 最后一位是当前的 path ？
    const parent = this.get(path.slice(0, -1))
    // key 这里的值是 path 的最后一位，也是当前的 moduleName
    const key = path[path.length - 1]
    // todo: runtime 用来标识什么？
    if (!parent.getChild(key).runtime) return

    parent.removeChild(key)
  }
}

function update(path, targetModule, newModule) {
  if (process.env.NODE_ENV !== 'production') {
    assertRawModule(path, newModule)
  }

  // update target module
  // 主动替换 newModule 的 namespaced, actions, mutations, getters 
  targetModule.update(newModule)

  // update nested modules
  if (newModule.modules) {
    for (const key in newModule.modules) {
      // 避免手动给当前的模块添加 modules 模块， 这样没有通过 addChild 函数， _children 中不会有对应的 key
      if (!targetModule.getChild(key)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
            'manual reload is needed'
          )
        }
        return
      }
      // todo: 这里的 update 的含义不是很明确
      update(
        path.concat(key),
        targetModule.getChild(key),
        newModule.modules[key]
      )
    }
  }
}

const functionAssert = {
  assert: value => typeof value === 'function',
  expected: 'function'
}

const objectAssert = {
  assert: value => typeof value === 'function' ||
    (typeof value === 'object' && typeof value.handler === 'function'),
  expected: 'function or object with "handler" function'
}

// todo: 为啥不校验 state ？
// getters mutations 以及 actions 的校验函数， 以及 expected 提示信息
const assertTypes = {
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert
}

function assertRawModule(path, rawModule) {
  Object.keys(assertTypes).forEach(key => {
    // getters mutations 以及 actions 如果没有的话，就不进行校验了，也就是说这三项是可以为不声明的，但是应该 state 是必须要的。
    if (!rawModule[key]) return
    const assertOptions = assertTypes[key]

    forEachValue(rawModule[key], (value, type) => {
      assert(
        assertOptions.assert(value),
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      )
    })
  })
}

// 生成提示信息
function makeAssertionMessage(path, key, type, value, expected) {
  let buf = `${key} should be ${expected} but "${key}.${type}"`
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`
  }
  buf += ` is ${JSON.stringify(value)}.`
  return buf
}
