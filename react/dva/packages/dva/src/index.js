import React from 'react';
import invariant from 'invariant';
// history 是一个JavaScript库,可以让您轻松地管理会话历史任何JavaScript运行。
// history 进行了抽象的差异在不同的环境和提供了一个最小的API,允许您管理历史堆栈,导航,确认导航和持续状态之间的会话。
import createHashHistory from 'history/createHashHistory';
// react-router-redux 是将react-router 和 redux 集成到一起的库，让你可以用redux的方式去操作react-router。
// 例如，react-router 中跳转需要调用 router.push(path)，集成了react-router-redux
// 你就可以通过dispatch的方式使用router，例如跳转可以这样做 store.dispatch(push(url))。
// 本质上，是把react-router自己维护的状态，例如location、history、path等等，也交给redux管理。一般情况下，是没有必要使用这个库的。
import {
  routerMiddleware,
  routerReducer as routing,
} from 'react-router-redux';
// require document 以及 window 这些全局变量
import document from 'global/document';
// react-redux提供了2个API，Provider和connect。
// Provider 源码解析: https://segmentfault.com/a/1190000010158572
import { Provider } from 'react-redux';
import * as core from 'dva-core';
import { isFunction } from 'dva-core/lib/utils';

export default function (opts = {}) {
  const history = opts.history || createHashHistory();
  const createOpts = {
    initialReducer: {
      routing,
    },
    setupMiddlewares(middlewares) {
      return [
        routerMiddleware(history),
        ...middlewares,
      ];
    },
    setupApp(app) {
      app._history = patchHistory(history);
    },
  };

  const app = core.create(opts, createOpts);
  const oldAppStart = app.start;
  app.router = router;
  app.start = start;
  return app;

  function router(router) {
    invariant(
      isFunction(router),
      `[app.router] router should be function, but got ${typeof router}`,
    );
    app._router = router;
  }

  function start(container) {
    // 允许 container 是字符串，然后用 querySelector 找元素
    if (isString(container)) {
      container = document.querySelector(container);
      invariant(
        container,
        `[app.start] container ${container} not found`,
      );
    }

    // 并且是 HTMLElement
    invariant(
      !container || isHTMLElement(container),
      `[app.start] container should be HTMLElement`,
    );

    // 路由必须提前注册
    invariant(
      app._router,
      `[app.start] router must be registered before app.start()`,
    );

    if (!app._store) {
      oldAppStart.call(app);
    }
    const store = app._store;

    // export _getProvider for HMR
    // ref: https://github.com/dvajs/dva/issues/469
    app._getProvider = getProvider.bind(null, store, app);

    // If has container, render; else, return react component
    if (container) {
      render(container, store, app, app._router);
      app._plugin.apply('onHmr')(render.bind(null, container, store, app));
    } else {
      return getProvider(store, this, this._router);
    }
  }
}

function isHTMLElement(node) {
  return typeof node === 'object' && node !== null && node.nodeType && node.nodeName;
}

function isString(str) {
  return typeof str === 'string';
}

function getProvider(store, app, router) {
  const DvaRoot = extraProps => (
    <Provider store={store}>
      {router({ app, history: app._history, ...extraProps })}
    </Provider>
  );
  return DvaRoot;
}

function render(container, store, app, router) {
  const ReactDOM = require('react-dom');  // eslint-disable-line
  ReactDOM.render(React.createElement(getProvider(store, app, router)), container);
}

function patchHistory(history) {
  // TODO:
  // history.listen 是什么
  const oldListen = history.listen;
  history.listen = (callback) => {
    // history.location就是window.location的一个子集
    callback(history.location);
    return oldListen.call(history, callback);
  };
  return history;
}
