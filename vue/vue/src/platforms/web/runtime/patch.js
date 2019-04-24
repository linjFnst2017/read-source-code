/* @flow */

// `nodeOps` 封装了一系列 DOM 操作的方法
import * as nodeOps from './node-ops'
import { createPatchFunction } from '../../../../src/core/vdom/patch'
import baseModules from '../../../../src/core/vdom/modules/index'
import platformModules from './modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
// 在应用了所有内置模块之后，应该最后应用指令模块
// `modules` 定义了一些模块的钩子函数的实现，平台模块和基础模块。它们会在整个 `patch` 过程的不同阶段执行相应的钩子函数
const modules = platformModules.concat(baseModules)

// 创建 patch 函数
export const patch: Function = createPatchFunction({ nodeOps, modules })
