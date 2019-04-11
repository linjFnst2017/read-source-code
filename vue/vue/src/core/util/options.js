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
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
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
  if (!vm) {
    // in a Vue.extend merge, both should be functions
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

strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

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
 *
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
      assertObjectType(key, childVal, vm)
    }
    if (!parentVal) return childVal
    const ret = Object.create(null)
    extend(ret, parentVal)
    if (childVal) extend(ret, childVal)
    return ret
  }
strats.provide = mergeDataOrFn

/**
 * Default strategy.
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
  // vm 中的 props ，如果是 数组的话，是最简单的形式，没有格式限制、默认值等
  // 如果是 简单对象的话，会有默认值，格式限制等。
  if (Array.isArray(props)) {
    i = props.length
    // 学习： 
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
    // Object.prototype.toString === object .... 表示一个纯对象
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
  // 前面所有的操作，如果一开始传入的 props 是数组（简单 props），将props转成 对象的形式
  // 再重新传回给 props，之后就可以统一当做一个对象进行处理
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 */
function normalizeInject(options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
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
 */
function normalizeDirectives(options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      // 注册的指令是一个函数的时候，则将该函数作为对象形式的 `bind` 属性和 `update` 属性的值。
      // 也就是说，可以把使用函数语法注册指令的方式理解为一种简写
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
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
  // TODO: 在哪里进行校验？ 如果没有任何配置的话
  // 这说明 Vue 初始化的时候， options 还可以是一个函数，但是需要包含 options 属性 ？
  // `child` 参数除了是普通的选项对象外，还可以是一个函数，如果是函数的话就取该函数的`options` 静态属性作为新的`child`
  if (typeof child === 'function') {
    child = child.options
  }

  // 规范化 props
  normalizeProps(child, vm)
  // TODO: 
  // 规范化 inject （2.2.0 之后新增， 不过这个一般用于高阶组件，放后面看吧）
  normalizeInject(child, vm)
  // 规范化 directives 指令
  normalizeDirectives(child)

  // TODO: 
  // 处理 `extends` 选项和 `mixins` 选项
  const extendsFrom = child.extends
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  if (child.mixins) {
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }
  const options = {}
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField(key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
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
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
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
