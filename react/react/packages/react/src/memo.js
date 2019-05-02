/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { REACT_MEMO_TYPE } from 'shared/ReactSymbols';

import isValidElementType from 'shared/isValidElementType';
import warningWithoutStack from 'shared/warningWithoutStack';

// memo 为 functional component 提供了类似 pure component 的功能，pure component 能够在 props 传入的值没有变化的情况下，不进行重新渲染
export default function memo<Props>(
  // 传入的 functional component
  type: React$ElementType,
  // oldProps newProps 进行比较的方法，类似于 shouldComponentUpdate 方法一样
  compare?: (oldProps: Props, newProps: Props) => boolean,
) {
  if (__DEV__) {
    if (!isValidElementType(type)) {
      warningWithoutStack(
        false,
        'memo: The first argument must be a component. Instead ' +
        'received: %s',
        type === null ? 'null' : typeof type,
      );
    }
  }
  // 具体的是都是在 react-dom 进行提供的。 
  return {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare === undefined ? null : compare,
  };
}
