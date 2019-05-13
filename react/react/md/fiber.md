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
    tag: TypeOfWork, // fiber的类型
    // 替换物
    alternate: Fiber|null, // 在fiber更新时克隆出的镜像fiber，对fiber的修改会标记在这个fiber上
    return: Fiber|null, // 指向fiber树中的父节点
    child: Fiber|null, // 指向第一个子节点
    sibling: Fiber|null, // 指向兄弟节点
    effectTag: TypeOfSideEffect, // side effect类型
    nextEffect: Fiber | null, // 单链表结构，方便遍历fiber树上有副作用的节点
    pendingWorkPriority: PriorityLevel, // 标记子树上待更新任务的优先级
}

```
在实际的渲染过程中，Fiber 节点构成了一颗树。这棵树在数据结构上是通过**单链表**的形式构成的，Fiber 节点上的 chlid 和 sibling 属性分别指向了这个节点的第一个子节点和相邻的兄弟节点。这样就可以遍历整个 Fiber 树了。

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

