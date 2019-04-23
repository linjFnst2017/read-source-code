/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from '../../../../src/core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
// 在应用了所有内置模块之后，应该最后应用指令模块
const modules = platformModules.concat(baseModules)

// 创建 patch 函数
export const patch: Function = createPatchFunction({ nodeOps, modules })
