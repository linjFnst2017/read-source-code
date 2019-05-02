/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LazyComponent, Thenable } from 'shared/ReactLazyComponent';

import { REACT_LAZY_TYPE } from 'shared/ReactSymbols';
import warning from 'shared/warning';

// lazy 组件可以非常方便实现异步组件加载
// const LazyComp = React.lazy(() => import('./lazyComp.js)) 
// 这样的使用方式 react 会自动将这一部分异步加载的组件从 bundle.js 中分离，做了一步 code split 的工作
// Thenable 理解为是一个 promise 对象
export function lazy<T, R>(ctor: () => Thenable<T, R>): LazyComponent<T> {
  let lazyType = {
    $$typeof: REACT_LAZY_TYPE,
    _ctor: ctor,
    // React uses these fields to store the result.
    // _status 标记着 Thenable 的状态， pedding 状态是 -1
    _status: -1,
    // _result 表示 Thenable resolve 之后的结果
    _result: null,
  };

  if (__DEV__) {
    // In production, this would just set it on the object.
    let defaultProps;
    let propTypes;
    Object.defineProperties(lazyType, {
      defaultProps: {
        configurable: true,
        get() {
          return defaultProps;
        },
        set(newDefaultProps) {
          warning(
            false,
            'React.lazy(...): It is not supported to assign `defaultProps` to ' +
            'a lazy component import. Either specify them where the component ' +
            'is defined, or create a wrapping component around it.',
          );
          defaultProps = newDefaultProps;
          // Match production behavior more closely:
          Object.defineProperty(lazyType, 'defaultProps', {
            enumerable: true,
          });
        },
      },
      propTypes: {
        configurable: true,
        get() {
          return propTypes;
        },
        set(newPropTypes) {
          warning(
            false,
            'React.lazy(...): It is not supported to assign `propTypes` to ' +
            'a lazy component import. Either specify them where the component ' +
            'is defined, or create a wrapping component around it.',
          );
          propTypes = newPropTypes;
          // Match production behavior more closely:
          Object.defineProperty(lazyType, 'propTypes', {
            enumerable: true,
          });
        },
      },
    });
  }

  return lazyType;
}
