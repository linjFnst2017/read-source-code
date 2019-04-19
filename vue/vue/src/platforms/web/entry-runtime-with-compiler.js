// 完整版的 Vue，入口文件是 entry-runtime-with-compiler.js，我们知道完整版和运行时版的区别就在于 compiler，
// 所以其实在我们看这个文件的代码之前也能够知道这个文件的作用：就是在运行时版的基础上添加 compiler
import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

// 导入 运行时 的 Vue
import Vue from './runtime/index'
import { query } from './util/index'
// 从 ./compiler/index.js 文件导入 compileToFunctions， 字面意思： 编译成函数？
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

// 从缓存中根据 id 获取元素的 innerHTML， 结果是一个函数，并且不用每次都去查，只要是查询过的就都有缓存
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 使用 mount 变量缓存 Vue.prototype.$mount 方法， 最后会需要再调用缓存下来的运行时版的 $mount 函数
const mount = Vue.prototype.$mount


// 比如手写组件时加入的 template 字符串（vue 文件中的 template 标签）都会在运行时编译， 而 render function 会在运行后返回 vnode 节点，
// 供页面的渲染以及 update 的 patch 。


// 重新定义了 Vue.prototype.$mount 函数并在重新定义的 $mount 函数体内
// 之所以重写 $mount 函数，其目的就是为了给运行时版的 $mount 函数增加编译模板的能力
Vue.prototype.$mount = function (
  el?: string | Element, // el 也可以是 dom 节点
  hydrating?: boolean // hydrating 保湿
): Component {
  // 使用 query 函数获取到指定的 DOM 元素并重新赋值给 el 变量
  el = el && query(el)

  /* istanbul ignore if */
  // 不能直接挂载到 body 标签 和 html 标签上去
  // 因为挂载点的本意是 组件挂载的占位，它将会被组件自身的模板 替换掉，而  <body> 元素和 <html> 元素显然是不能被替换掉的
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // render 选项，是否包含渲染函数， render不存在的时候才会编译template，否则优先使用render
  if (!options.render) {
    // 使用 template 或 el 选项构建渲染函数。 
    // 所以也就是说 运行时版的 vue 是不能够使用模板渲染的。 
    let template = options.template // 这里应该通过 webpack 的 vue-loader 模块编译之后能够获得 template 这个参数。 并且能知道 template 是挂载在 options 上的
    if (template) {
      if (typeof template === 'string') {
        // TODO: 我怎么感觉像是根节点的编译呢？
        // 第一个字符是 #
        if (template.charAt(0) === '#') {
          // TODO: 相当于说这里的 template 编译出来结果应该是一个类似 "#app" 这样的结果
          // 会把该字符串作为选择符去选中对应的元素，并把该元素的 innerHTML 作为模板
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
        // nodeType 元素节点存在
      } else if (template.nodeType) {
        // nodeType 应该是正常 vue 文件的编译结果， template为DOM节点
        template = template.innerHTML
      } else {
        // 模板编译的结果只有两种，一种是 # 类型的，一种是 nodeType
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        // 返回实例，毕竟后面的页面还是要继续渲染的， 报错归报错
        return this
      }
    } else if (el) {
      // TODO: 感觉这里才像是 根节点
      // 如果不存在 template 的话，直接获取根 html 节点 （outerHTML）
      template = getOuterHTML(el)
    }

    // template 变量中存储着最终用来生成渲染函数的字符串， 但还是有可能是一个空字符串
    if (template) {
      /* istanbul ignore if */
      // 记录、计算代码的渲染性能
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // vue 编译的入口
      // 使用 compileToFunctions 函数将模板(template)字符串编译为渲染函数(render)
      // 这是vue的编译时优化，static静态不需要在VNode更新时进行patch，优化性能
      const { render, staticRenderFns } = compileToFunctions(template, {
        // 分析参数： 
        // 目的是对浏览器的怪癖做兼容
        shouldDecodeNewlines,
        //  目的是对浏览器的怪癖做兼容
        shouldDecodeNewlinesForHref,
        // `delimiters` 和 `comments` 都是 `Vue` 提供的选项
        delimiters: options.delimiters,
        comments: options.comments
      }, this)

      // 将通过 template 字符串模板渲染出来的结果 render 函数作为 this.$options.render  这样能够直接在 运行时版的 vue 中被 mountComponent 函数直接调用
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      // 记录、计算代码的渲染性能
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 如果渲染函数存在那么什么都不会做，直接调用运行时版 $mount 函数即可。 也就是说 运行时的 mount 函数挂载是直接通过
  // mountComponent 函数的第一个参数 options 中获取了 render 函数进行渲染。
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 * 获取元素的 outerHTML， 设置或获取对象及其内容的HTML形式，也就是标签和文本内容全都显示出来
 */
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

// 在 Vue 上添加一个全局API `Vue.compile` 其值为上面导入进来的 compileToFunctions
Vue.compile = compileToFunctions

export default Vue
