/* @flow */

// 导入创建编译器的配置
import { baseOptions } from './options'
// createCompiler: 创建一个编译器, 在 src/compiler/index.js 文件下
import { createCompiler } from 'compiler/index'

//  `compileToFunctions` 函数是通过以 `baseOptions` 为参数调用 `createCompiler` 函数创建出来
// `compile` 函数生成的是字符串形式的代码，
// 而`compileToFunctions` 生成的才是真正可执行的代码
const { compile, compileToFunctions } = createCompiler(baseOptions)
// 导出创建出来的编译器和编译函数
export { compile, compileToFunctions }
