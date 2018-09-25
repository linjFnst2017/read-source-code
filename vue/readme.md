# vue 生态源码阅读

## vue 源码

vue 最简单的调用是：
```
var app = new Vue({
  ...
})

// mount
app.$mount('.todoapp')
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

