# vue 生态源码阅读

## vue 源码

vue 最简单的调用是：
```
var app = new Vue({
  ...
})

// mount
app.$mount('.TODO:app')
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