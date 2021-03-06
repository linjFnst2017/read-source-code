/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

// 编译器创建者 的 创建者
export function createCompilerCreator(baseCompile: Function): Function {
  // 这里的 `createCompiler` 其实就同于 编译器的创建者
  // 实际上 `compile` 函数与 `compileToFunctions` 函数的区别就在于 `compile` 函数生成的是字符串形式的代码，
  // 而`compileToFunctions` 生成的才是真正可执行的代码 
  return function createCompiler(baseOptions: CompilerOptions) {

    // 将字符串模板转化成字符串函数， 
    // 编译，将模板template编译成AST、render函数以及staticRenderFns函数
    function compile(
      template: string, // 模板字符串
      options?: CompilerOptions // 参数选项
    ): CompiledResult {
      // 最终的选项，`Object.create` 函数以 `baseOptions` 为原型创建 `finalOptions` 常量
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []
      // finalOptions 原生是不携带 warn 属性的
      // 1、`msg` 错误或提示的信息，2、`tip` 用来标示 `msg` 是错误还是提示。
      // 可以猜想的到 `warn` 选项主要用在编译过程中的错误和提示收集，如果收集的信息是错误信息就将错误信息添加到前面定义的 `errors` 数组里，
      // 如果是提示信息就将其添加到`tips` 数组里
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }

      // 合并使用编译器编译模板时传递的选项参数 options 与 baseOptions 
      // `baseOptions` 理解为编译器的默认选项或者基本选项， `options` 是用来提供定制能力的扩展选项
      // 做下面这些 merge 的目的因为不同平台可以提供自己本身平台的一个 baseOptions，内部封装了平台自己的实现，
      // 然后把共同的部分抽离开来放在这层 compiler 中，所以在这里需要 merge 一下
      if (options) {
        // merge custom modules
        // 合并 modules 数组
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        // 合并directives
        // 由于 `directives` 是对象而不是数组，所以不能采用与 `modules` 相同的处理方式，
        // 对于`directives` 采用原型链的原理实现扩展属性对基本属性的覆盖。
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        // 对于 `options` 中既不是 `modules` 又不是 `directives` 的其他属性，采用直接复制过去的方式进行处理
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      // 基础模板编译，得到编译结果
      // `compile` 函数对模板的编译是委托 `baseCompile` 完成的
      const compiled = baseCompile(template, finalOptions)
      // `compiled` 是 `baseCompile` 对模板的编译结果，该结果中包含了模板编译后的抽象语法树(AST)，
      // 可以通过`compiled.ast` 访问该语法树
      if (process.env.NODE_ENV !== 'production') {
        // 用来通过抽象语法树来检查模板中是否存在错误表达式的
        // detectErrors： 最终返回一个数组，该数组中包含了所有错误的收集
        errors.push.apply(errors, detectErrors(compiled.ast))
      }
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      // 编译器的创建结果
      compile,
      // 模板解析函数， compileToFunctions 函数是可以直接执行的
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
