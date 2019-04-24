/* @flow */

// 导入创建编译器的配置
import { baseOptions } from './options'
// createCompiler: 创建一个编译器, 在 src/compiler/index.js 文件下
import { createCompiler } from '../../../compiler/index'

//  `compileToFunctions` 函数是通过以 `baseOptions` 为参数调用 `createCompiler` 函数创建出来
// `compile` 函数生成的是字符串形式的代码，就是一个编译器， 它会将传入的 template 字符串转成 AST、render函数以及staticRenderFns函数
// 而`compileToFunctions` 生成的才是真正可执行的代码， 是带缓存的编译器。
// 这里之所以要写一个创建编译器函数，是因为需要根据不同平台来分别创建编译器，比如 web 平台和 mobie 平台是不一样的编译器。尽可能复用代码，利用柯里化
// 先传一个 baseOptions 创建一个基础的编译器。 complie 函数再传入平台自身特有的参数，形成 finalOptions 进行编译。
const { compile, compileToFunctions } = createCompiler(baseOptions)
// 导出创建出来的编译器和编译函数
export { compile, compileToFunctions }
