/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { Dispatcher } from 'react-reconciler/src/ReactFiberHooks';

/**
 * Keeps track of the current dispatcher.
 * 跟踪当前 dispatcher
 */
const ReactCurrentDispatcher = {
  /**
   * @internal
   * @type {ReactComponent}
  */
  // 当前正在渲染的节点实例
  current: (null: null | Dispatcher),
};

export default ReactCurrentDispatcher;
