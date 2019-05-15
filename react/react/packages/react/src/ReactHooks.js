/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ReactContext } from 'shared/ReactTypes';
import invariant from 'shared/invariant';
import warning from 'shared/warning';

import ReactCurrentDispatcher from './ReactCurrentDispatcher';

function resolveDispatcher() {
  // ReactCurrentDispatcher 是一个全局的类，current 是 react-dom 进行设置的
  const dispatcher = ReactCurrentDispatcher.current;
  invariant(
    dispatcher !== null,
    'Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for' +
    ' one of the following reasons:\n' +
    '1. You might have mismatching versions of React and the renderer (such as React DOM)\n' +
    '2. You might be breaking the Rules of Hooks\n' +
    '3. You might have more than one copy of React in the same app\n' +
    'See https://fb.me/react-invalid-hook-call for tips about how to debug and fix this problem.',
  );
  return dispatcher;
}

// 只管定义，不管实现
export function useContext<T>(
  Context: ReactContext<T>,
  unstable_observedBits: number | boolean | void,
) {
  const dispatcher = resolveDispatcher();
  if (__DEV__) {
    warning(
      unstable_observedBits === undefined,
      'useContext() second argument is reserved for future ' +
      'use in React. Passing it is not supported. ' +
      'You passed: %s.%s',
      unstable_observedBits,
      typeof unstable_observedBits === 'number' && Array.isArray(arguments[2])
        ? '\n\nDid you call array.map(useContext)? ' +
        'Calling Hooks inside a loop is not supported. ' +
        'Learn more at https://fb.me/rules-of-hooks'
        : '',
    );

    // TODO: add a more generic warning for invalid values.
    if ((Context: any)._context !== undefined) {
      const realContext = (Context: any)._context;
      // Don't deduplicate because this legitimately causes bugs
      // and nobody should be using this in existing code.
      if (realContext.Consumer === Context) {
        warning(
          false,
          'Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be ' +
          'removed in a future major release. Did you mean to call useContext(Context) instead?',
        );
      } else if (realContext.Provider === Context) {
        warning(
          false,
          'Calling useContext(Context.Provider) is not supported. ' +
          'Did you mean to call useContext(Context) instead?',
        );
      }
    }
  }
  // 调用了ReactCurrentOwner.current.xxx对应的方法。
  return dispatcher.useContext(Context, unstable_observedBits);
}

// useState 不过就是个语法糖 ， 本质上是 dispatcher 的 useState 函数。（这个版本中 useState 已经不是通过 useReducer 实现了）
export function useState<S>(initialState: (() => S) | S) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useReducer(reducer, initialArg, init);
}

export function useRef<T>(initialValue: T): { current: T } {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
}

export function useEffect(
  create: () => (() => void) | void,
  inputs: Array<mixed> | void | null,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, inputs);
}

export function useLayoutEffect(
  create: () => (() => void) | void,
  inputs: Array<mixed> | void | null,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useLayoutEffect(create, inputs);
}

export function useCallback(
  callback: () => mixed,
  inputs: Array<mixed> | void | null,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useCallback(callback, inputs);
}

export function useMemo(
  create: () => mixed,
  inputs: Array<mixed> | void | null,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useMemo(create, inputs);
}

export function useImperativeHandle<T>(
  ref: { current: T | null } | ((inst: T | null) => mixed) | null | void,
  create: () => T,
  inputs: Array<mixed> | void | null,
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useImperativeHandle(ref, create, inputs);
}

export function useDebugValue(value: any, formatterFn: ?(value: any) => any) {
  if (__DEV__) {
    const dispatcher = resolveDispatcher();
    return dispatcher.useDebugValue(value, formatterFn);
  }
}

// // hooks demo
// // 简单说 hooks 就是让 functional component 有很多 class component 拥有的行为，包括内置的状态，以及“生命周期函数”
// import React, { useState, useEffect } from 'react';
// // 函数式组件没有 this 。 hooks 给与了 functional component 一些只有在 class component 才有的能力。
// // 但是 hooks 的出现并不是为了让 functional component 替代 class component ，而是为了能够拆分组件内部的逻辑，提出出来给更多的组件进行复用。
// // 
// // useState 函数给了一个默认值，返回值是一个数组，第一个参数被赋予了默认值，第二个参数是改变第一个参数值的方法
// export default () => {
//   const [name, setName] = useState('yiliang')
//   // useEffect 给与了 functional component 生命周期方法，每一次组件内容更新时都会调用 useEffect 传入的回调函数
//   // useEffect 不区分 mounted 和 updated， mounted 的时候也是执行 useEffect 中的回调函数
//   useEffect(() => {
//     console.log('component updated')

//     // 每次执行之后都会清除上一次的状态
//     return () => {
//       console.log('unbind')
//     }
//     // 如果这里传入一个空数组的话，就只有在组件销毁的时候执行一次，updated 的时候就不执行了。
//   }, [])
//   return (
//     <p>my name is {name}</p>
//     <input type="text" value={name} onChange={e => setName(e.target.value)} />
//   )
// }