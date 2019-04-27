## 参考文件
电子书：
https://react.jokcy.me/

### 文件夹

- packages
  - events 是 react 的事件系统，自己实现的事件传播体系
  - react npm 安装的核心代码库
  - react-dom 这个包非常依赖 react-reconciler 这个包
  - scheduler react 16 之后实现的异步渲染的方式核心代码库
  - shared 

### 开始
react 在使用过程中很少会使用 react.xxx 这样的 api 形式，那为什么需要手动引入 react 包呢？ 因为 jsx 对于 react 有很强的关系在这里，jsx 编译成 js 的时候会自动做引用 api 的工作吧。

react 包的代码量很少，但是 react 与 react-dom 压缩之后加起来大概也有 100k 左右，主要的代码量都在 react-dom 包中。react 是定义节点以及表现行为的包。所以这一部分代码都放在平台相关的逻辑里面。

### JSX
babel playground: https://babeljs.io/repl/
jsx 可以在 js 代码中写 html 的代码，会被 jsx 的 babel 编译成 js 代码，例如：
```jsx
<div id="app"></div>
```
会被编译成
```js
'use strict'

React.createElement("div", {id: 'app'}, null)
```

jsx babel 当前的插件当前是通过判断标签的首字母是否是大写来选择编译成组件（变量）还是字符串的， 如果是字符串的话，react 会认为是一个原生的 dom 节点，如果找不到这个节点的话，react 就会报错，所以自定义的组件必须大写开头。


### Context
跨越多层组件实现传递信息的功能。
有两个 api:
- childContextType 老的 api React 17 废弃这个 api
- createContext React 16 之后提供的