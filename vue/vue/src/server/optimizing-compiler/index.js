/* @flow */

import { parse } from 'compiler/parser/index'
import { generate } from './codegen'
import { optimize } from './optimizer'
import { createCompilerCreator } from 'compiler/create-compiler'

export const createCompiler = createCompilerCreator(function baseCompile(
  template: string,
  options: CompilerOptions
): CompiledResult {
  const ast = parse(template.trim(), options)
  // 服务端的渲染的时候不需要指定 options.optimize 参数，直接执行 optimize 函数优化 ast 即可。
  // parse 代码是复用跟 web 端一样的解析代码，无论是什么平台，解析成 ast 的逻辑是一样的
  // optimize generate 代码是来自于本文件夹下，针对服务端渲染的特定代码，证明不同平台的优化和生成 render 函数的过程是不一样的。
  optimize(ast, options)
  const code = generate(ast, options)
  return {
    ast,
    // staticRenderFns 以及r ender 函数会被转换成Funtion对象
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
