/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
// 函数就是用来创建编译器的， createCompiler：称之为”编译器的创建者“
// createCompilerCreator： '编译器创建者' 的创建者
// baseCompile 函数作为 '编译器创建者' 的创建者 的参数
export const createCompiler = createCompilerCreator(function baseCompile(
  // 字符串模板
  template: string,
  // 选项参数
  options: CompilerOptions
): CompiledResult {
  // 调用 parse 函数将字符串模板解析成抽象语法树(AST)
  const ast = parse(template.trim(), options)

  /**
   * 将 ast 进行优化
   * 优化的目标是：生成模板 ast 检测不需要进行 dom 改变的静态子树
   * 一旦检测到这些静态树，我们就做下面的事情：
   * 1. 把它们变成常数，这样我们就再也不需要每次重新渲染时创建新的节点了。
   * 2. 在patch的过程中直接跳过。
   */

  if (options.optimize !== false) {
    // 调用 optimize 函数优化 ast
    optimize(ast, options)
  }
  // 调用 generate 函数将 ast 编译成渲染函数， `generate` 处理 `ast` 之后得到的返回值 `code` 是一个对象，内部包含 render 与 staticRenderFns
  // 该对象的属性中包含了渲染函数（注意以上提到的渲染函数，都以字符串的形式存在，
  // 因为真正变成函数的过程是在`compileToFunctions` 中使用`new Function()` 来完成的
  const code = generate(ast, options) // 实际上 code 对象中中的 render 属性和 staticRenderFns 属性都是字符串形式的函数
  return {
    // 抽象语法树(`ast`)
    ast,
    // 渲染函数
    render: code.render,
    // 静态渲染函数
    staticRenderFns: code.staticRenderFns
  }
})
