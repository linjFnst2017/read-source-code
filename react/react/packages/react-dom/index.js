/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

'use strict';

const ReactDOM = require('./src/client/ReactDOM');

// TODO: decide on the top-level export form.
// This is hacky but makes it work with both Rollup and Jest.
module.exports = ReactDOM.default || ReactDOM;


// 在 React 中最主要的更新方式有三个：
// 1. ReactDOM.render || hydrate
// 2. setState
// 3. forceUpdate

// ReactDOM.render 做的事情：
// 1. 创建 ReactRoot
// 2. 创建 FiberRoot 和 RootFiber
// 3. 创建更新