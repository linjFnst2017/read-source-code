/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters(Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   * 创建资产注册方法
   */
  // ASSET_TYPES => { component, directive, filter }
  // Vue 分别用来全局注册组件，指令和过滤器三个全局函数的定义
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object // 定义
    ): Function | Object | void {
      if (!definition) {
        // Vue.options 中只有一些基础配置， components 中是默认的一些组件 还有 directives  filters 等
        // 如果没有给 definition 只给了 id 的话，只要求从 options 返回已经存在的组件即可
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        // 扩展 options
        if (type === 'component' && isPlainObject(definition)) {
          // 实际上这里的 definition 就是 options 用于 new Vue 的
          // 如果 options 中没有 name 的话， 组件名就采用注册时的 id
          definition.name = definition.name || id
          // _base === Vue Vue.extend 函数的作用是将 参数（一个类 options） 与 Vue.options 进行 merge 并返回结果
          definition = this.options._base.extend(definition)
        }
        // 扩展 directive 
        if (type === 'directive' && typeof definition === 'function') {
          // 对于指令而言没有详细指定是 bind update 等时期的话，只需要简单注册 bind update 同样的函数即可
          definition = { bind: definition, update: definition }
        }
        // 全局注册指令、组件，挂载到原型的 options 属性上
        // 但是实际上挂载到原型链上不是也可以起到继承选项的效果么？
        // 这里我是这么想的：vm.options 或者 $options 往往指的是跟这个实例相关的配置，指不同组件的选项。 
        // 而如果挂载在 Vue 原型上的话，就表示所有的子代都可以获取到，这样可以不会对局部选项和全局选项起冲突。
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
