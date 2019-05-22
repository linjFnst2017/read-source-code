### 写在前面

Fiber 架构是在 React 16 之后引入的一个全新的架构，旨在解决异步渲染的问题。新的架构使得异步渲染成为可能，但是需要注意的是，只是可能。React 没有在 16 发布的时候就立刻开启异步渲染，也就是说 react 16 发布之后依然使用的还是同步渲染机制， 只是这个异步渲染机制没有立刻被采用。所有的 react 16 一系列的新功能都是基于 Fiber 架构的。

### fiber

fiber 结构改变了之前 react 组件的渲染机制，新的架构使原来同步渲染的组件现在可以异步化， 可中途中断渲染，执行更高优先级的任务，释放浏览器主进程。

React 核心算法的更新： 这次更新了一个从底层重写 react 的 reconciliation 算法（是 react 用来比较两颗 dom 树差异、从而判断哪一部分应该被更新的算法）。这次算法重写带来的主要特性是“异步渲染”。异步渲染的意义在于能够将渲染任务划分为多块。浏览器的渲染引擎是单线程的，这意味着几乎多有的行为都是同步发生的。React 16 使用原生的浏览器 api 来间歇性地检查当前是否还有其他任务需要完成，从而实现对主线程和渲染过程的管理。在之前的版本中，react 在计算 dom 树的时候会锁住整个线程。

这个 reconciliation 的过程现在被称作 “stack reconciliation”。尽管 React 已经是以快而闻名了，但是锁住整个线程也会让一些应用运行得不是很流畅。16 这个版本通过不要求渲染过程在初始化后一次性完成修复了该问题。React 计算了 DOM 树的一部分，之后将暂停渲染，来看看主线程是否有任何的绘图或者更新需要去完成。一旦绘图和更新完成了，React 就会继续渲染。这个过程通过引入了一个新的，叫做 “fiber” 的数据结构完成，fiber 映射到了一个 React 实例并为该实例管理其渲染任务，它也知道它和其他 fiber 之间的关系。

react16 以前的组件渲染方式存在一个问题，如果这是一个很大，层级很深的组件，react渲染它需要几十甚至几百毫秒，在这期间，react会一直占用浏览器主线程，任何其他的操作（包括用户的点击，鼠标移动等操作）都无法执行。好似一个潜水员，当它一头扎进水里，就要往最底层一直游，直到找到最底层的组件，然后他再上岸。在这期间，岸上发生的任何事，都不能对他进行干扰，如果有更重要的事情需要他去做（如用户操作），也必须得等他上岸。fiber架构—组件的渲染顺序：潜水员会每隔一段时间就上岸，看是否有更重要的事情要做。加入fiber的react将组件更新分为两个时期（phase 1 && phase 2），render 前的生命周期为 phase1，render 后的生命周期为 phase2。　

　　phase1 的生命周期是可以被打断的，每隔一段时间它会跳出当前渲染进程，去确定是否有其他更重要的任务。此过程，React 在 workingProgressTree （并不是真实的virtualDomTree）上复用 current 上的 Fiber 数据结构来一步步地构建新的 tree，标记需要更新的节点，放入队列中。phase2 的生命周期是不可被打断的，React 将其所有的变更一次性更新到DOM上。这里最重要的是 phase1 这是时期所做的事。因此我们需要具体了解 phase1 的机制。

　　如果不被打断，那么phase1执行完会直接进入render 函数，构建真实的 virtualDomTree。如果组件在 phase1 过程中被打断，即当前组件只渲染到一半（也许是在 willMount,也许是 willUpdate 反正是在 render 之前的生命周期），那么react会怎么干呢？ react会放弃当前组件所有干到一半的事情，去做更高优先级更重要的任务（当然，也可能是用户鼠标移动，或者其他react监听之外的任务）。当所有高优先级任务执行完之后，react通过 callback 回到之前渲染到一半的组件，从头开始渲染。

　　React 16 也会在必要的时候管理各个更新的优先级。这就允许了高优先级更新能够排到队列开头从而被首先处理。关于此的一个例子就是按键输入。鉴于应用流畅性的考虑，用户需要立即获得按键响应，因而相对于那些可以等待 100-200 毫秒的低优先级更新任务，按键输入拥有较高优先级。


### Fiber 节点的数据结构
```js
{
    tag: WorkTag, // fiber的类型
    // 替换物
    alternate: Fiber|null, // 在fiber更新时克隆出的镜像fiber，对fiber的修改会标记在这个fiber上
    return: Fiber|null, // 指向 fiber 树中的父节点
    child: Fiber|null, // 指向第一个子节点
    sibling: Fiber|null, // 指向兄弟节点
    effectTag: TypeOfSideEffect, // side effect类型
    nextEffect: Fiber | null, // 单链表结构，方便遍历fiber树上有副作用的节点
    pendingWorkPriority: PriorityLevel, // 标记子树上待更新任务的优先级
    stateNode: any // 与此 fiber 相关联的本地状态
}

```
在实际的渲染过程中，Fiber 节点构成了一颗树。这棵树在数据结构上是通过**单链表**的形式构成的，Fiber 节点上的 chlid 和 sibling 属性分别指向了这个节点的第一个子节点和相邻的兄弟节点。这样就可以遍历整个 Fiber 树了。

WorkTag 具体的值定义在 `ReactWorkTags.js` 中：

```js
export type WorkTag =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20;
```

这个文件中具体再往下看，可以看到对于不同 Component 类型的定义，也都是给了具体的数字形式，而不是字符串的形式来判断，这样是不是能加快判断的速度？
```js
export const HostRoot = 3;
```

```js
  ...
  if (node === null && fiber.tag === HostRoot) {
    root = fiber.stateNode;
  } else {
  ...
```

#### TypeOfWork
代表React中不同类型的fiber节点
```js
{
  IndeterminateComponent: 0, // Before we know whether it is functional or class
  // 函数式组件
  FunctionalComponent: 1,
  // 就是应用层面的React组件。ClassComponent是一个继承自React.Component的类的实例
  ClassComponent: 2,
  // ReactDOM.render()时的根节点
  HostRoot: 3, // Root of a host tree. Could be nested inside another node.
  HostPortal: 4, // A subtree. Could be an entry point to a different renderer.
  // React中最常见的抽象节点，是ClassComponent的组成部分。HostComponent：React中最常见的抽象节点，是ClassComponent的组成部分。具体的实现取决于React运行的平台。在浏览器环境下就代表DOM节点，可以理解为所谓的虚拟DOM节点。HostComponent中的Host就代码这种组件的具体操作逻辑是由Host环境注入的。
  HostComponent: 5,
  HostText: 6,
  CoroutineComponent: 7,
  CoroutineHandlerPhase: 8,
  YieldComponent: 9,
  Fragment: 10,
}
```


#### TypeOfSideEffect
这是以二进制位表示的，可以多个叠加。
```js
{
  NoEffect: 0,          
  PerformedWork: 1,   
  Placement: 2, // 插入         
  Update: 4, // 更新           
  PlacementAndUpdate: 6, 
  Deletion: 8, // 删除   
  ContentReset: 16,  
  Callback: 32,      
  Err: 64,         
  Ref: 128,          
}

```

#### performUnitOfWork
React 16保持了之前版本的事务风格，一个“work”会被分解为begin和complete两个阶段来完成。

### Fiber 具体是做什么的
Fiber 以 render 函数为界，分成了 render phase 和 commit phase。 第一阶段是 render phase ， Fiber 会找出需要更新哪些 dom，在这个阶段是可以被打断的；但是到了第二阶段 commit phase ，开始操作 dom，是不能被打断的。

第一阶段render phase包括以下生命周期函数:
- componentWillMount
- componentWillReceiveProps
- shouldComponentUpdate
- componentWillUpdate

第二阶段Commit phase包含以下生命周期函数:
- componentDidMount
- componentDidUpdate
- componentWillUnMount

比如说一个低优先级的任务 A 正在执行，此时已经调用了某一个组件的 componentWillUpdate 函数，接下来发现自己的时间分片已经用完了，于是冒出水面，看看有没有紧急任务，如果此时有一个紧急任务 B ，接下来 React Fiber 就会先去执行这个紧急任务 B ，虽然任务 A 执行到一半，但是没有办法只能完全放弃，等到任务 B 全部搞定会后，任务 A 重新执行一遍， 注意这里是重新来一遍，不是从刚才中断的部分开始，也就是说 componentWillUpdate 函数会被再执行一次。

#### React 16.3 之前的生命周期

1. 初始化阶段 Initialization: 初始化 props 和 state
2. 挂载阶段 Mounting: 先后执行 componentWillMount 函数，render 函数，以及 componentDidMount 函数
3. 更新阶段 Updation: 
  a: props 部分会先执行 componentWillReceiveProps 钩子函数，接着执行 shouldComponentUpdate 函数，根据这个函数返回的结果来判断是否继续执行下面的更新（因为 props 引起的），如果 shouldComponentUpdate 函数返回的结果是 false 就不继续往下执行了；如果 shouldComponentUpdate 函数返回的结果是 true， 则接下来会先后执行 componentWillUpdate 函数，render 函数，以及 componentDidUpdate 函数。
  b: state 部分会直接执行 shouldComponentUpdate 函数，后面的逻辑与 props 相同， 会根据 shouldComponentUpdate 函数返回的结果来决定是否继续执行 Update 相关的钩子函数。
4. 卸载阶段 Unmounting: 执行 componentWillUnmount 钩子函数


如果需要开始 异步渲染（async rendering） ， 在 render 函数之前的所有函数都有可能会被执行多次。
> 比如很多开发者会在 componentWillMount 里写 ajax 来获取数据的功能，他们会认为 componentWillMount 在 render 之前执行，早一点执行早点得到结果。但是在 componentWillMount 里发起 ajax 请求，不管多快得到结果也赶不上首次执行 render （事件循环机制决定的吧 ？）， 这样的 IO 操作通常放在 componenDidMount 里更合适。 在 Fiber 启用异步渲染之后，更加没有理由在 componentWillMount 钩子中做 ajax 请求，因为 componentWillMount 钩子可能会被执行多次。

React 官方也意识到了这个问题，觉得有必要去劝告（阻止）开发者不要在 render phase 阶段里写有副作用的代码（副作用： 简单说就是做本函数之外的事情，比如 ajax 操作，修改全局变量之类的），为此 React 16 调整了声明周期。

#### React 16.4 生命周期

![](https://user-gold-cdn.xitu.io/2018/8/12/1652a030ed1506e0?imageView2/0/w/1280/h/960/format/webp/ignore-error/1)

图中的 render 阶段： 纯净但没有副作用， 可能会被 React 暂停、中止或者重新执行
Pre-commit 阶段：可以读取 dom
commit 阶段： 可以使用 dom ，运行副作用，安排更新

生命周期一旦被打断，下次恢复时又会再跑一次之前的生命周期，也就是被重新执行。因此 componentWillMount componentWillReceiveProps 和 componentWillUpdate 都不能保证只在挂载、拿到 props 、状态发生改变的时候刷新一次了，所以这三个方法被标记位不安全。


React16废弃的三个生命周期函数:
1. ~~componentWillMount~~
2. ~~componentWillReceiveProps~~
3. ~~componentWillUpdate~~

> 需要注意的是，目前在16版本中componentWillMount，componentWillReceiveProps，componentWillUpdate并未完全删除这三个生命周期函数，而且新增了UNSAFE_componentWillMount，UNSAFE_componentWillReceiveProps，UNSAFE_componentWillUpdate三个函数，官方计划在17版本完全删除这三个函数，只保留UNSAVE_前缀的三个函数，目的是为了向下兼容，但是对于开发者而言应该尽量避免使用他们，而是使用新增的生命周期函数替代它们

新增的钩子函数：
1. static getDerivedStateFromProps
2. getSnapshotBeforeUpdate

从上面可以看到，除了 shouldComponentUpdate 有助于提升渲染性能的之外，其他render phase阶段的生命周期都被去掉了。另外需要注意：Render函数本身属于render phase，也可能会被打断，会执行很多次；



getDerivedStateFromProps:
1. 当 state 需要从 props 初始化时使用
2. 每次 render 都会被调用
3. 静态函数，无法访问 this
4. 典型场景：表单控件获取默认值
> 根据nextProps和prevState计算出预期的状态改变;静态函数，无法访问this，控制台打印为undefined; 这个静态函数返回的结果会被送给setState

getSnapshotBeforeUpdate:
1. 每次 ui 更新时被调用
2. 典型场景：页面需要根据
> 触发时间: update发生的时候，在组件dom渲染之前; 返回一个值，作为componentDidUpdate的第三个参数


#### FIber 小结
- Fiber 将渲染分成了两个阶段： render phase 和 commit phase。 render phase 可以被打断，不要在此阶段做一些有副作用的操作。
- 生命周期调整， react 把你有可能在 render phase 里做有副作用的函数都改成了 static 函数，强迫开发者做一些纯函数的操作


### 异步渲染 Async render
计算能力和网络速度分别对应计算机设备的 CPU 和 IO 能力。在 React 中， CPU 主要影响 DOM 元素的创建和更新效率，而 IO 则影响获取数据和懒加载的代码。

时间分片（Time Slicing）：DOM 操作的优先级低于浏览器原生行为，例如键盘和鼠标输入，从而保证操作的流畅。
渲染挂起（Suspense）：虚拟 DOM 节点可以等待某个异步操作的完成，并制定  timeout， 之后才能完成真正的渲染。

#### 时间分片（Time Slicing）
同步模式下，每输入一个字符，React 就开始渲染，当 React 渲染一棵巨大的树的时候，是非常卡的。

Debounced (去颤抖) 模式简单说就是延迟渲染， 比如当输入完成后，就开始渲染所有的变化。这么做至少不会阻塞用户的输入了，但是依然有非常严重的卡顿。

异步渲染模式就是不阻塞当前线程，继续跑。

特性：
1. React 在渲染 render 时， 不会阻塞现在的线程
2. 如果你的设备足够快，你会感觉渲染是同步的
3. 如果你的设备非常慢，你会感觉还算是灵敏的
4. 虽然是异步渲染，但是你将会看到完整的渲染，而不是一个组件一行一行渲染出来


##### 实现原理:
1. 虚拟 dom 的 diff 算法操作可以分片进行。从 reactDOM.render 函数变成了 ReactDOMFiber.render 函数。 使用了 ReactFiver 去渲染整个页面，ReactFiber 会将整个更新任务分成若干个小的更新任务，然后设置一些任务默认的优先级。 **每执行完一个小任务之后，会释放主线程。**
2. React 的新 API unstable_deferredUpdates，指定低优先级更新，这个UI更新会等高优先级的更新完了再去更新
3. Chrome 新API： 
  - equestIdleCallback
  - requestAnimationFrame
  - requestIdleCallback： 浏览器提供一个API告诉浏览器不忙了，比如不再滚动页面，不再敲击键盘；可以react知道低优先级更新不应该在浏览器忙的时候去操作；
  React新api支持依赖于浏览器的支持，目前Chrome支持比较好，ie11 ，safari浏览器不支持。

Suspense 解决的问题:
1. 代码分片
2. 异步获取数据。 Suspense 在 16.6 的时候已经解决了代码分片的问题，异步获取数据还没有正式发布。




https://juejin.im/post/5b6f1800f265da282d45a79a

http://km.oa.com/group/11800/articles/show/371648?kmref=search&from_page=1&no=1

http://km.oa.com/articles/show/380104?kmref=search&from_page=1&no=2
http://km.oa.com/group/20807/articles/show/351438?kmref=search&from_page=1&no=3
