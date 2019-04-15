/* @flow */

import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

function createFunction(code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}

// 真正的编译函数
export function createCompileToFunctionFn(compile: Function): Function {
  const cache = Object.create(null)

  // 返回值是一个函数， 我们真正需要的 compileToFunctions 函数
  return function compileToFunctions(
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    // 扩展出一个新对象
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
    // delimiters 分割符号
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (cache[key]) {
      return cache[key]
    }

    // compile
    // 整个函数最核心的代码， 返回的是编译结果， 包含了编译过程中的错误和提示信息
    // compile 函数是执行函数的参数， 真正的编译工作是依托于 `compile` 函数
    // options 被删除了 warn， template 被透传
    const compiled = compile(template, options)

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
      // 编译过程中的错误和提示信息
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
    const res = {}
    const fnGenErrors = []
    // `render` 属性，实际上就是最终生成的渲染函数， compiled.render 应该是一个函数体的字符串形式
    // fnGenErrors： 创建函数出错时的错误信息被 `push` 到这个数组里了
    res.render = createFunction(compiled.render, fnGenErrors)
    //  `staticRenderFns` 静态渲染方法， 主要作用是渲染优化
    // `res.staticRenderFns` 是一个函数数组，是通过对 `compiled.staticRenderFns` 遍历生成的
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
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
