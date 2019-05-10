/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactVersion from 'shared/ReactVersion';
import {
  REACT_CONCURRENT_MODE_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_PROFILER_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_SUSPENSE_TYPE,
} from 'shared/ReactSymbols';

import { Component, PureComponent } from './ReactBaseClasses';
import { createRef } from './ReactCreateRef';
import { forEach, map, count, toArray, only } from './ReactChildren';
import {
  createElement,
  createFactory,
  cloneElement,
  isValidElement,
  jsx,
} from './ReactElement';
import { createContext } from './ReactContext';
import { lazy } from './ReactLazy';
import forwardRef from './forwardRef';
import memo from './memo';
// 使用 hooks 必须要安装 react 和 react-dom 16.7 以上的版本
import {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useDebugValue,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from './ReactHooks';
import {
  createElementWithValidation,
  createFactoryWithValidation,
  cloneElementWithValidation,
  jsxWithValidation,
  jsxWithValidationStatic,
  jsxWithValidationDynamic,
} from './ReactElementValidator';
import ReactSharedInternals from './ReactSharedInternals';
import { error, warn } from './withComponentStack';
import {
  enableStableConcurrentModeAPIs,
  enableJSXTransformAPI,
} from 'shared/ReactFeatureFlags';

const React = {
  // 尽量使用 React.Children 提供的 api 来操作 children， 长得跟数组长得比较像
  Children: {
    map,
    forEach,
    count,
    toArray,
    only,
  },

  createRef,
  Component,
  PureComponent,

  createContext,
  forwardRef,
  lazy,
  memo,

  error,
  warn,

  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useDebugValue,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,

  // react 原生的组件
  // React.Fragment 用作在 return 的时候有多个兄弟节点，然而又不想在最外层包一层没有意义的 div 标签的时候的处理。 将兄弟节点标签都包在 <React.Fragment></React.Fragment> 标签中即可
  Fragment: REACT_FRAGMENT_TYPE,
  Profiler: REACT_PROFILER_TYPE,
  // 标志它下面包含的子节点都需要按照某一种模式进行渲染
  StrictMode: REACT_STRICT_MODE_TYPE,
  // Suspense 组件中的异步组件渲染，其中抛出一个或者多个 promise 之前都会执行 Suspense 组件上指定的 fallback 属性指定的回调函数
  // 只有 Suspense 组件中的所有异步组件都加载完成了之后，才会去掉 fallback。 
  Suspense: REACT_SUSPENSE_TYPE,

  // JSX 中描述的 React 组件最终会被 Babel 转移成 React.createElement 函数，不同的组件只是对应的 createElement 的传参不同
  createElement: __DEV__ ? createElementWithValidation : createElement,
  cloneElement: __DEV__ ? cloneElementWithValidation : cloneElement,
  // 使用 jsx 的开发者几乎不会用到，因为不会去使用 是对 createElement 这个 api。 createElement 函数的一层封装，
  createFactory: __DEV__ ? createFactoryWithValidation : createFactory,
  isValidElement: isValidElement,

  version: ReactVersion,

  unstable_ConcurrentMode: REACT_CONCURRENT_MODE_TYPE,

  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: ReactSharedInternals,
};

// Note: some APIs are added with feature flags.
// Make sure that stable builds for open source
// don't modify the React object to avoid deopts.
// Also let's not expose their names in stable builds.

// 有些api添加了特性标志,确保开放源码的稳定构建不会修改React对象以避免deopt, 另外，不要在稳定的构建中公开它们的名称
// 目前 16.8 版本的 React 中, enableStableConcurrentModeAPIs 值都是 false , 所以其中某一些 api 和属性已经没有了。
if (enableStableConcurrentModeAPIs) {
  React.ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;
  React.unstable_ConcurrentMode = undefined;
}

if (enableJSXTransformAPI) {
  if (__DEV__) {
    React.jsxDEV = jsxWithValidation;
    React.jsx = jsxWithValidationDynamic;
    React.jsxs = jsxWithValidationStatic;
  } else {
    React.jsx = jsx;
    // we may want to special case jsxs internally to take advantage of static children.
    // for now we can ship identical prod functions
    React.jsxs = jsx;
  }
}

export default React;
