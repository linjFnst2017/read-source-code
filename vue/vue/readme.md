# vue 生态源码阅读
写在前面，这个 repo 是我在实际工作和学习中的阅读源码的记录，本来对于阅读源码这一件事情很疑惑，明明现在上车已经很晚了（外面对于 vue 的剖析的文档博客早就满天飞了），那为什么还要自己逐字逐句逐行去阅读呢？理解原理的话，其实集合各家的精髓就应该足够了，而且频繁出现的“vue 源码” 类的博文，想必外界都已经疲惫了。我后来想了很久，说到底是我一直不够明白为什么我要阅读它，我是为了工作中更方便排查一些问题？ 还是说是为了写

http://hcysun.me/vue-design/art/

## vue 源码

vue 最简单的调用是：
```
var app = new Vue({
  ...
})
```

那么接下来的源码阅读就从 new Vue({...}) 开始。

Vue 构造函数的位置在 `src/core/instance/index.js` 文件中，主要的逻辑是“强化”Vue构造函数的功能：
```
function Vue(options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)
```

其中 initMixin 函数做的工作主要是：
1. initLifecycle 初始化生命周期函数
2. initEvents 初始化事件机制
3. initRender 初始化 render 函数 ？


### vue 实例属性

- vm.$data  vue 实例观察的数据对象
- vm.$props vue 实例（当前组件）接收到的props对象
- vm.$el vue 实例当前使用的根DOM元素
- vm.$options vue 实例的初始化选项，在单vue文件中就是 export default {...} 中的内容，需要在选项中包含自定义属性时会有用处：
  ```
  new Vue({
    customOption: 'foo',
    created: function () {
      console.log(this.$options.customOption) // => 'foo'
    }
  })
  ```
- vm.$parent vue 实例的父实例 ？
- ...



### 以简单的例子为例：
```
<div id="app">{{test}}</div>
...
var vm = new Vue({
    el: '#app',
    data: {
        test: 1
    }
})
```

以这一段代码为例，简单创建了一个 vue 实例。 调用 new Vue 的时候传递了两个参数: el 和 data 进去，接着就去找一下 Vue 的构造函数。
Vue 的构造函数定义在 core/instance/index.js 文件中:

```
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
```

也就是说实际我们调用 new Vue 创建一个 Vue 实例的时候，是调用了 this._init(options) 函数，options 是构造函数的参数。

```
options = {
    el: '#app',
    data: {
        test: 1
    }
}
```

接着看一看 _init 函数做的事情, _init 方法在 src/core/instance/init.js:

```
const vm = this
vm._uid = uid++
```

vm 常量存储一下当前的 Vue 实例。 并声明一个 _uid 变量来记录当前 Vue 实例的 uid， 最开始的 uid 值为 0， 每调用一次 _init 函数就会 +1

_init 函数中，config 的值跟只读属性 Vue.config 指向的是同一个值， Vue 提供了全局配置 Vue.config.performance，我们通过将其设置为 true，即可开启性能追踪，你可以追踪四个场景的性能：

1、组件初始化(component init)
2、编译(compile)，将模板(template)编译成渲染函数
3、渲染(render)，其实就是渲染函数的性能，或者说渲染函数执行且生成虚拟DOM(vnode)的性能
4、打补丁(patch)，将虚拟DOM渲染为真实DOM的性能

```
let startTag, endTag
/* istanbul ignore if */
// config.performance 默认为 false ，默认不记录渲染性能。 mark 是浏览器 window.performance.mark 函数
if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
  startTag = `vue-perf-start:${vm._uid}`
  endTag = `vue-perf-end:${vm._uid}`
  mark(startTag)
}

...

if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
  // 简单理解 formatComponentName 的作用是通过一定的格式化方式返回了一个 name，会避免所有 vue 实例的 _name 重复
  vm._name = formatComponentName(vm, false)
  mark(endTag)
  // 计算渲染的性能 
  measure(`vue ${vm._name} init`, startTag, endTag)
}

```



### 响应式原理

Watcher 和 Dep 实例是在一起的。 
Observer 实例与被观察的值是在一起的。 比如 this._data 是一个被观察的对象，被扩展了一个 __ob__ 属性值，是一个 Observer 实例，内容包含了主要是包含了 Dep 实例。


## 蛮难理解的东西

### 模板编译
https://segmentfault.com/a/1190000012922342

### 指令