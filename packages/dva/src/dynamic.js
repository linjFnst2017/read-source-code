import React, { Component } from 'react';

const cached = {};
// 注册dva modal
function registerModel(app, model) {
  model = model.default || model;
  // model 对象中的 namespace 缓存进 cached 对象中，下次就不需要再执行 app.model(model) 这个操作
  // todo
  // app.model(model) 是用来将model 挂载到app对象上去的么？？？
  if (!cached[model.namespace]) {
    app.model(model);
    cached[model.namespace] = 1;
  }
}

// 无状态组件，默认的加载组件返回null
let defaultLoadingComponent = () => null;

// react的高阶组件
// 异步加载组件
function asyncComponent(config) {
  const { resolve } = config;

  return class DynamicComponent extends Component {
    // ...args 获取到 构造函数中的 arguments
    // 我通常会在constructor函数中不输入参数，在super(...arguments)来获取到参数
    // todo
    // 为什么这里super(...args) 不传参数的话，react 的props是失效的？？？
    constructor(...args) {
      super(...args);
      // 加载的组件会从高阶组件的参数config中传参，如果config中没有 LoadingComponent 值，就会使得动态组件（DynamicComponent）
      // 的LoadingComponent 属性等于一个返回null的react组件.
      this.LoadingComponent =
        config.LoadingComponent || defaultLoadingComponent;
      // todo
      // 为什么这里需要设定一个 AsyncComponent 属性到state中？？？
      this.state = {
        AsyncComponent: null,
      };
      this.load();
    }

    componentDidMount() {
      this.mounted = true;
    }

    componentWillUnmount() {
      this.mounted = false;
    }

    load() {
      resolve().then((m) => {
        // todo
        // 为什么这里的防止default 为空的操作要这么写 ？？？
        // 逻辑上感觉应该是 如果没有值传递进来表示这里的 AsyncComponent 值的话,就取 m.default 才对啊 ？？？
        const AsyncComponent = m.default || m;
        if (this.mounted) {
          this.setState({ AsyncComponent });
        } else {
          // todo
          // 改变state中的 AsyncComponent 值为什么这样操作 ？？？
          // 直接通过 this.state.AsyncComponent 改变值的结果是: 值能够真实被改变,但是不会触发react 的重绘
          // 所以 如果在这个异步组件没有卸载之后, 不需要去重绘的话,为什么直接不赋值就好了？？？
          this.state.AsyncComponent = AsyncComponent; // eslint-disable-line
        }
      });
    }

    render() {
      const { AsyncComponent } = this.state;
      const { LoadingComponent } = this;
      // 如果存在异步组件有内容的话,就渲染异步组件,并且将 props 原样传递下去
      if (AsyncComponent) return <AsyncComponent {...this.props} />;
      // 如果异步组件没有内容的话,就选在加载组件内容
      // todo
      // 但是这里为什么需要 将props 传递下去？？？
      return <LoadingComponent {...this.props} />;
    }
  };
}

export default function dynamic(config) {
  // todo
  // 这里config 对应的是 dva项目 src 文件夹下的 app, models 文件夹, component 文件夹 ？？？
  const { app, models: resolveModels, component: resolveComponent } = config;
  // 传递给asyncComponent的参数 config 是在下面拼装而成的。
  return asyncComponent({
    // config 中的 resolve 方法 return 一个 promise
    resolve: config.resolve || function () {
      // todo
      // 不知道这里的resolveModels 为什么是一个 function， 理论上来说应该是 models 文件夹下的 dva对象 ？？？
      // 默认值是一个空数组，难道resolveModels 函数是返回dva项目下的所有models ？？？
      const models = typeof resolveModels === 'function' ? resolveModels() : [];
      // todo
      // 暂时也不知道为什么resolveComponent 也是一个function
      const component = resolveComponent();
      return new Promise((resolve) => {
        // todo
        // Promise.all
        Promise.all([...models, component]).then((ret) => {
          // 如果 dva 项目中的 model 对象个数为 0
          if (!models || !models.length) {
            return resolve(ret[0]);
          } else {
            const len = models.length;
            // todo
            // m.default 到底是个啥 ？？？
            ret.slice(0, len).forEach((m) => {
              m = m.default || m;
              // todo
              // 为啥又要扩展成数组 ？？？
              // note
              // Array.isArray(m)
              if (!Array.isArray(m)) {
                m = [m];
              }
              // todo
              // 看起来像是 每一个 m 中有很多个model ？？？
              m.map(_ => registerModel(app, _));
            });
            // todo
            // 看一下ret是个啥？？？
            resolve(ret[len]);
          }
        });
      });
    },
    // todo
    // 感觉这里应该是 config 在前, resolve 在后吧 ?  不然 config.resolve 为空会被覆盖的吧 ？？？
    ...config,
  });
}

// todo
// function 也是一个 object， 这里又扩展了一个方法
// 这个方法为什么会改变上面定义的 LoadingComponent ？？？
// 理论上来说，这里的 dynamic 对象的 LoadingComponent 应该是 undefined ，而不是上面定义的无状态组件吧？？？
// 但是事实上应该是的。
dynamic.setDefaultLoadingComponent = (LoadingComponent) => {
  defaultLoadingComponent = LoadingComponent;
};
