/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

// 从 options 中获取 name 或者 tag 名
function getComponentName(opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

// 分别针对数组、字符串、正则表达式形式的传值，检测某一个 pattern 中是否存在 name
function matches(pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  // pattern 表达式只接受数组、字符串、正则表达式，其他的形式直接返回 false
  return false
}

// 修正缓存
function pruneCache(keepAliveInstance: any, filter: Function) {
  // TODO: _vnode 不确定是什么意思
  // cache, keys 是在 created 中声明的两个参数
  const { cache, keys, _vnode } = keepAliveInstance
  // 取出 cache 中的 vnode
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      // 遍历cache中的所有项，如果不符合filter指定的规则的话，则会执行pruneCacheEntry
      if (name && !filter(name)) {
        // 删除实例引用
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

// 销毁vnode对应的组件实例（Vue实例）
function pruneCacheEntry(
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key]
  if (cached && (!current || cached.tag !== current.tag)) {
    // 调用组件实例的$destroy方法来将组件销毁
    cached.componentInstance.$destroy()
  }
  // 为什么需要先将 vnode 节点置为 null 之后再把 key 从数组中删除？
  // 因为 js 内存回收机制。循环引用的时候就会释放不掉内存， 需要手工断开js对象和DOM之间的链接， 赋值为null。
  // https://blog.csdn.net/yingzizizizizizzz/article/details/77333996
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

/**
 * TODO:
 * keep-alive提供了两个生命钩子，分别是 activated 与deactivated
 * 因为 keep-alive 会将组件保存在内存中，并不会销毁以及重新创建，所以不会重新调用组件的 created 等方法，
 * 需要用 activated 与 deactivated 这两个生命钩子来得知当前组件是否处于活动状态
 * 
 * 最主要的功能是，通过将组件缓存起来，不进行销毁，实现组件的缓存。
 */
// keep-alive 是 vue 的核心库中自带的一个组件
export default {
  name: 'keep-alive',
  // 是否是抽象组件。 abstract 选项来声明这是一个抽象组件。
  // 除了不渲染真实DOM，抽象组件还有一个特点，就是它们不会出现在父子关系的路径上。
  // 这么设计也是合理的，这是由它们的性质所决定的
  abstract: true,

  // 规定组件 props 传值的 type
  props: {
    // 包括和排除组件，都可以通过用逗号分隔字符串、正则表达式或一个数组来表示
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  created() {
    // 直接在 this 上挂在属性的不好之处有哪些？
    // TODO: 
    // @Wonderful: 这里需要知道的是，在 created 钩子函数中直接挂载 xxx 到 this 上去是可以的，并且也会被响应式监听（不需要首先在 data 中声明 xxx, 因为 created 钩子函数的执行早于 data 对象的 observe ？）
    // 而如果在 data 中没有声明的属性，直接在 mounted 中使用或者赋值的话就会报错了， 因为 vuejs 编译 html 模板替换 mustache 标签为 _s(name) 的时候， name 是没有办法获取到的。
    // created钩子会创建一个cache对象，用来作为缓存容器，保存vnode节点
    this.cache = Object.create(null)
    this.keys = []
  },

  destroyed() {
    // destroyed 钩子则在组件被销毁的时候清除 cache 缓存中的所有组件实例
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted() {
    // 监视 include 以及 exclude ，在被修改的时候对 cache 进行修正
    this.$watch('include', val => {
      // 拿新的条件去匹配
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  render() {
    // TODO: $slots 插槽 ？runtime 加到 vm 实例上的，并不是 vue 对外暴露的一个 api
    const slot = this.$slots.default
    // 得到 slot 插槽中的第一个组件
    const vnode: VNode = getFirstComponentChild(slot)
    // TODO: componentOptions
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      // 获取组件名称，优先获取组件的 name 字段，否则是组件的 tag
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      // name 不在 inlcude 中或者在 exlude 中则直接返回 vnode（没有取缓存） 
      if (
        // 不在 include 中
        (include && (!name || !matches(include, name))) ||
        // 在 exclude 中
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      // key 是 vnode 的标识
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        // 相同的构造函数可以注册为不同的本地组件，所以仅仅cid是不够的
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      // 从缓存中获取
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        // TODO: 
        // 保证当前的 key 新鲜？
        remove(keys, key)
        keys.push(key)
      } else {
        // 还未进行缓存则进行缓存
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        // 如果缓存超过了最大限制的个数，就手动注销第一个 vnode 实例
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }
      // keepAlive标记位
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
