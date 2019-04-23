/* @flow */

import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

// code 函数体字符串
function createFunction(code, errors) {
  try {
    // 通过 new Function 的形式将 函数体字符串 转化为一个函数
    return new Function(code)
  } catch (err) {
    // 收集错误，自带容器
    errors.push({ err, code })
    return noop
  }
}

// 真正的编译函数
export function createCompileToFunctionFn(compile: Function): Function {
  // cache 用来缓存函数执行的结果
  const cache = Object.create(null)

  // 返回值是一个函数， 我们真正需要的 compileToFunctions 函数
  return function compileToFunctions(
    template: string,
    options?: CompilerOptions,
    vm?: Component // vm 实例本身
  ): CompiledFunctionResult {
    // 扩展出一个新对象， 是浅层拷贝（属性级别）
    options = extend({}, options)
    // 检查选项参数中是否包含 warn，如果没有则使用 baseWarn
    const warn = options.warn || baseWarn
    // 将 options.warn 属性删除
    delete options.warn

    /* istanbul ignore if */
    // 总之这段代码的作用就是检测 `new Function()` 是否可用，不能使用的话，找其他方案来实现。
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      try {
        new Function('return 1')
      } catch (e) {
        // 如果有错误发生且错误的内容中包含诸如 `'unsafe-eval'` 或者 `'CSP'` 这些字样的信息时就会给出一个警告
        // 我们知道 `CSP` 全称是内容安全策略，如果你的策略比较严格，那么 `new Function()` 将会受到影响，从而不能够使用
        // 但是将模板字符串编译成渲染函数又依赖 `new Function()`，所以解决方案有两个：
        // 1. 放宽你的CSP策略
        // 2. 2、预编译
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    // 这么做的目的是缓存字符串模板的编译结果，防止重复编译，提升性能
    // delimiters 分割符号. 如果用户有自定义的分隔符的话，将分隔符 + template 作为一个 key 来缓存编译函数
    // TODO: 这里难道就不担心， template 很长很长么？
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    // 存在直接返回 `cache[key]` 从缓存中拿 template
    if (cache[key]) {
      return cache[key]
    }

    // compile
    // 整个函数最核心的代码， 返回的是编译结果， 包含了编译过程中的错误和提示信息
    // compile 函数是执行函数的参数， 真正的编译工作是依托于 `compile` 函数
    // options 被删除了 warn， template 被透传
    // 这里的 compile 函数就是 ./create-compiler.js 文件中的 createCompiler 函数体（闭包）中定义的 compile 函数
    const compiled = compile(template, options)

    // check compilation errors/tips
    // 检查编译过程中的错误和提示信息，如果有的话，在非生产环境下打印出来
    if (process.env.NODE_ENV !== 'production') {
      // 编译过程中的错误和提示信息。
      // errors tips 都是数组，需要循环打印错误信息，不同的是 errors 通过 warn 函数（就是上面通过 finalOptions.warn 储存的函数）来打印
      // 而 tips 需要通过 tip 函数进行打印
      if (compiled.errors && compiled.errors.length) {
        warn(
          `Error compiling template:\n\n${template}\n\n` +
          compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
          vm
        )
      }
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(msg => tip(msg, vm))
      }
    }

    // turn code into functions
    const res = {} // 最终的返回值
    const fnGenErrors = []
    // `render` 属性，实际上就是最终生成的 渲染函数！！！， compiled.render 应该是一个函数体的字符串形式
    // fnGenErrors： 创建函数出错时的错误信息被 `push` 到这个数组里了
    // compiled 是 compile 编译函数的结果，也就是说，compile 函数编译模板字符串之后所得到的是字符串形式的函数体，赋值给了 render 属性（string）
    res.render = createFunction(compiled.render, fnGenErrors) // 根据字符串形式的 render 函数创建可执行的 render 函数（调用 new Function() ）
    //  `staticRenderFns` 静态渲染方法， 主要作用是渲染优化
    // `res.staticRenderFns` 是一个 函数数组 （code 是字符串形式的函数体），是通过对 `compiled.staticRenderFns` 遍历生成的
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    // 用来打印在生成渲染函数过程中的错误
    // 这段代码的作用主要是用于开发 `codegen` 功能时使用，一般是编译器本身的错误，所以对于我们来讲基本用不到
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

    // 返回编译结果的同时，将结果缓存
    return (cache[key] = res)
  }
}
