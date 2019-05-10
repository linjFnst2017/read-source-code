// 这整个文件的作用都是为了 Vue 选项（参数）的合并
import config from '../config'
import { warn } from './debug'
import { nativeWatch } from './env'
import { set } from '../observer/index'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
  // } from 'shared/util'
} from '../../shared/util'


/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 * 选项覆盖策略是处理如何将父选项值和子选项值合并到最终值的函数
 */
//  在 config 中一开始是一个空对象 Object.create(null)
// 反正就是奇怪的合并选项的方式，可以自定义 https://vuejs.org/v2/api/#optionMergeStrategies
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  // 非生产环境下在`strats` 策略对象上添加两个策略(两个属性)分别是`el` 和`propsData`
  // 且这两个属性的值是一个函数。这两个策略函数是用来合并 `el` 选项和 `propsData` 选项的。
  // 与其说“合并”不如说“处理”，因为其本质上并没有做什么合并工作。
  strats.el = strats.propsData = function (parent, child, vm, key) {
    // 策略函数判断函数调用的时候是否获取到了 vm 这个参数，这个可以不传。 但是在 _init 初始化 Vue 实例的时候是传了 vm 参数的，对应的 Vue.extend
    // 函数执行的时候，策略函数也会被执行，但是不会传 vm 这个参数。
    // 所以在这里能够根据是否有这么 vm 传参可以知道， mergeOptions 是在实例化时被调用的（使用 new 操作符号调用 _init 方法）还是在继承的时候被调用 Vue.extend
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    // @Wonderful: 子组件的实现方式就是通过实例化子类完成的，子类又是通过 `Vue.extend` 创造出来的，
    // 所以我们就能通过对`vm` 的判断而得知是否是子组件了。所以最终的结论就是：*如果策略函数中拿不到 `vm` 参数，那么处理的就是子组件的选项
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */
function mergeData(to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
export function mergeDataOrFn(
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 跟合并策略对象上的 vm 参数一样，只有 new Vue 实例的时候才会传 vm 对象，如果没有 vm 参数，就是子组件调用
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    // 选项是在调用 `Vue.extend` 函数时进行合并处理的，此时父子 `data` 选项都应该是函数。 
    // 这里有一个比较大的误解是： 我一直以为这里的父 data 是只根 vue 实例的 data。 但实际上子组件是通过子类 extend 之后获得的， 父 data 是只
    // Vue.extend({ options }) 这里的 options.data 
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    // 当父子选项同时存在，那么就返回一个函数 `mergedDataFn`
    return function mergedDataFn() {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    return function mergedInstanceDataFn() {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

// `strats` 策略对象上添加 `data` 策略函数，用来合并处理 `data` 选项
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 先判断是否传递了 `vm` 这个参数， 如果没有 vm 对象的时候是在处理子组件
  if (!vm) {
    // childVal: 是否传递了子组件的 `data` 选项(即：`childVal`), 子组件的 data 是否是 function
    if (childVal && typeof childVal !== 'function') {
      // TODO: 原理，vue 是如何进行响应式的
      // （子）组件的 data 必须是一个函数， 不然好像 vue 无法进行监听
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )
      // TODO: 为什么子组件 data 为空就返回父组件的 data ？
      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  // mergeDataOrFn 永远返回的是一个函数
  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
function mergeHook(
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 * 在 `Vue` 中 `directives`、`filters` 以及 `components` 被认为是资源
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets(
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 * 用来合并处理同名选项
 */
strats.props =
  strats.methods =
  strats.inject =
  strats.computed = function (
    parentVal: ?Object,
    childVal: ?Object,
    vm?: Component,
    key: string
  ): ?Object {
    if (childVal && process.env.NODE_ENV !== 'production') {
      // 校验是否是一个纯对象
      assertObjectType(key, childVal, vm)
    }
    // 如果没有 parentVal 的话直接返回这个纯对象， 否则的话就将 parentVal 以及 childVal 属性都扩展到这个对象上去
    // 与 watch 和其他钩子函数的合并策略不同的是，这里 childVal 将会覆盖 parentVal 上的同名属性
    if (!parentVal) return childVal
    const ret = Object.create(null)
    extend(ret, parentVal)
    if (childVal) extend(ret, childVal)
    return ret
  }
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 * 默认的合并策略： 只要子选项不是 `undefined` 那么就是用子选项，否则使用父选项。
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 * 验证组件名字是否符合要求
 */
function checkComponents(options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName(name: string) {
  // 单词字符包括：a-z、A-Z、0-9，以及下划线。
  if (!/^[a-zA-Z][\w-]*$/.test(name)) {
    // `Vue` 限定组件的名字由普通的字符和中横线(-)组成，且必须以字母开头。
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'can only contain alphanumeric characters and the hyphen, ' +
      'and must start with a letter.'
    )
  }
  // `isBuiltInTag` 方法的作用是用来检测你所注册的组件是否是 Vue 内置的标签
  // isReservedTag  作用应该是校验名字是否是 html 的预留名字， 定义在 web/util/element.js 中 web 特有的 api （想想也是，其他平台应该不需要考虑这个问题吧。。。）
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    // 总之就是不要将 html 预留的名字 和 Vue 的一些内置标签名字用作 vue 实例的名字
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 * 确保所有的 props 参数语法都是 以 Object 为基础的格式
 */
function normalizeProps(options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  if (Array.isArray(props)) {
    // vm 中的 props ，如果是数组的话，成员都应该是字符串，是最简单的形式，没有格式限制、默认值等
    i = props.length
    // 使用 i-- 来终止 while 的自循环
    while (i--) {
      val = props[i]
      // props 通过数组的形式传值，必须是 string 语法
      if (typeof val === 'string') {
        // camelize: （横线）转驼峰格式（这个单词见了那么多次竟然没有认出来）
        name = camelize(val)
        // 通过数组传的 props { type: null } 估计后面就不对类型进行校验了
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    // 如果是 简单对象的话，会有默认值，格式限制等。Object.prototype.toString === object .... 表示一个纯对象
    for (const key in props) {
      val = props[key]
      // 横线转驼峰
      name = camelize(key)
      // // 第一种写法，直接写类型
      // someData1: Number,
      // // 第二种写法，对象
      // someData2: {
      //   type: String,
      //   default: ''
      // }
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    // props 只接受数组或者对象的形式
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      // Object.prototype.toString 看一下 props 的类型
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  // 前面所有的操作，如果一开始传入的 props 是数组（简单 props），将 props 转成 对象的形式。
  // 再重新传回给 props，之后就可以统一当做一个对象进行处理
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 * inject 的使用方式说白了就跟 props 是一样的，值有两种形式，一种是字符串数组，另一种就是对象的键值形式
 */
function normalizeInject(options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  // 将 normalized 跟 options.inject 指向同一个对象，后面就只操作 normalized
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      // 每一个值都会变成包含一个 key 是 from 的值的对象
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 * 将原始函数指令规范化为对象格式
 */
function normalizeDirectives(options: Object) {
  // 在 options 中注册的 directives 是一个对象
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      // 注册的指令是一个函数的时候，则将该函数作为对象形式的 `bind` 属性和 `update` 属性的值。
      // 也就是说，可以把使用函数语法注册指令的方式理解为一种简写
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
      // TODO:
      // 当然了也就是说 def 是一个对象的话就不做处理了。也就是说这里有一个问题是如果 def 是一个对象，但是并没有包含任何指令的钩子函数
      // 这里既不会报错，也不会有任何执行。感觉这里在开发环境下应该提醒一下开发者。
    }
  }
}

function assertObjectType(name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 * 合并两个选项对象为一个新的对象，这个函数在实例化和继承的时候都有用到
 * 
 * 这里的三个参数分别为：
 * 1. 最年老实例的选项
 * 2. 当前的选项
 * 3. 当前的实例
 * 最终 merge 选项成为一个新的对象
 */
export function mergeOptions(
  parent: Object,
  child: Object,
  vm?: Component
): Object {

  if (process.env.NODE_ENV !== 'production') {
    // 非生产环境下去校验 options.components 数组中的名字是不是跟一些内置、预留的名字冲突了
    checkComponents(child)
  }

  // 很多时候都会先声明一个 function child() {...} 之后，再给child挂载 一个 options
  // 这说明 Vue 初始化的时候， options 还可以是一个函数，但是需要包含 options 属性 ？
  // `child` 参数除了是普通的选项对象外，还可以是一个函数，如果是函数的话就取该函数的`options` 静态属性作为新的`child`
  // 这里是应对 extends 的情况，parent = mergeOptions(parent, extendsFrom, vm) extendsFrom 参数的值是一个构造函数
  // Cotr.options 
  if (typeof child === 'function') {
    child = child.options
  }

  // 规范化 props。 给 child 挂载上了一个 props 属性，值统一是对象。 $options.props
  normalizeProps(child, vm)
  // 规范化 inject （2.2.0 之后新增， 不过这个一般用于高阶组件，放后面看吧）感觉跟 React 的 context 好像啊。。。
  // provider/inject：简单的来说就是在父组件中通过provider来提供变量，然后在子组件中通过inject来注入变量
  normalizeInject(child, vm)
  // 规范化 directives 指令. 
  normalizeDirectives(child)

  // 处理 `extends` 选项
  // options.extends 属性是用于在没有调用 `Vue.extends` 时候继承某一个 Vue 组件。 
  // 严谨地讲值是一个构造函数，这里的 extends 值是一个 import 的 Vue 类，实际 export 的是这个类的构造函数。
  // 同样继承的方式只要是将原始类型的 options merge 到子类型（也是 vm 实例）上去就行了
  const extendsFrom = child.extends
  if (extendsFrom) {
    // 如果某个组件在 options 写了 extends 的话就主动继承，也就是去合并一下继承的
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  // 处理 `mixins` 选项。 值是一个对象数组， 对象的内容是 options 的部分（也就是需要混入的部分）
  if (child.mixins) {
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      // child.mixins[i] 值是一个对象，不同于上面的 extendsFrom ，这个对象其实就可以理解为一个 options， 所以直接进行 mergeOptions
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }
  const options = {}
  let key
  // Vue.options: Vue.options = { components: { KeepAlive, Transition, TransitionGroup }, directives:{ model, show }, filters: Object.create(null), _base: Vue }
  for (key in parent) {
    // `key` 就应该分别是：`components`、`directives`、`filters` 以及 `_base`
    // 除了 `_base` 其他的字段都可以理解为是 `Vue` 提供的选项的名字。 _base === Vue 就是构造函数
    mergeField(key)
  }
  // child 值是 Vue.options. 理论上包含 data props methods watch render template 等值
  // TODO: 但是实际继承的过程中， template 貌似并没有继承，data 似乎也没有
  // 实际上是合并策略搞得鬼，默认状态是只要子项不是 undefined 就用子项属性，否则就用父项
  for (key in child) {
    // hasOwn: Object.prototype.hasOwnProperty 作用是用来判断一个属性是否是对象自身的属性(不包括原型上的)
    if (!hasOwn(parent, key)) {
      // 如果 `child` 对象的键也在 `parent` 上出现，那么就不要再调用 `mergeField` 了，
      // 因为在上一个`for in` 循环中已经调用过了，这就避免了重复调用
      mergeField(key)
    }
  }
  function mergeField(key) {
    // strats 各种合并函数
    const strat = strats[key] || defaultStrat
    // vm 是从 mergeOptions 函数中透传过来。 而 mergeOptions 函数中的第三个参数 vm 中在 _init 函数中执行的时候调用时传的 vm 也就是当前实例本身
    options[key] = strat(parent[key], child[key], vm, key)
  }
  // return 是 mergeOptions 函数的返回
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 * 说明在使用 Vue.component(id, definition) 全局注册组件的时候，id 可以是连字符、驼峰或首字母大写的形式。
 */
export function resolveAsset(
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  // 组件、指令或者过滤器等对象
  const assets = options[type]
  // check local registration variations first
  // 首先检查本地注册变量
  if (hasOwn(assets, id)) return assets[id]
  // 把 id 变成驼峰的形式
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  // 驼峰的基础上把首字母再变成大写的形式
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
