/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { Fiber } from 'react-reconciler/src/ReactFiber';

/**
 * Keeps track of the current owner.
 *
 * The current owner is the component who should own any components that are
 * currently being constructed.
 * TODO:
 * 当前所有者是应该拥有当前正在构建的任何组件的组件。(完全没听懂是什么意思。。。是说任何当前正在构建组件的最浅一级的父组件？)
 */
const ReactCurrentOwner = {
  /**
   * @internal
   * @type {ReactComponent}
   */
  current: (null: null | Fiber),
};

export default ReactCurrentOwner;
