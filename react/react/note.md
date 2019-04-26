### 文件夹

- packages
  - events 是 react 的事件系统，自己实现的事件传播体系
  - react npm 安装的核心代码库
  - react-dom 这个包非常依赖 react-reconciler 这个包
  - scheduler react 16 之后实现的异步渲染的方式核心代码库
  - shared 

### 开始
react 在使用过程中很少会使用 react.xxx 这样的 api 形式，那为什么需要手动引入 react 包呢？ 因为 jsx 对于 react 有很强的关系在这里，jsx 编译成 js 的时候会自动做引用 api 的工作吧。