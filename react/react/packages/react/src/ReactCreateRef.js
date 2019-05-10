/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @flow
 */

import type { RefObject } from 'shared/ReactTypes';

// TODO: objRef 对象是如何挂载，如何存储 ？
// an immutable object with a single mutable value
// 一个具有单个可变值的不可变对象。属性（只要没有设置不可修改、配置）值都可以改变，但是不能删除属性，修改属性的配置
// React 中可以通过 ref 方便得获取一个节点实例
export function createRef(): RefObject {
  const refObject = {
    current: null,
  };
  if (__DEV__) {
    // 
    Object.seal(refObject);
  }
  return refObject;
}

// React 中 ref 的三种使用方式
// 1. string ref
// 2. function 
// 3. createRef 这是 React 提供的方法

// 使用方式：
{/* <p ref="stringRef">span1</p>
<p ref={ele => this.methodRef = ele}>span2</p>
<p ref={this.objRef}>span3</p> */}

// 获取方式
// this.refs.stringRef.textContext = 'xxx'
// this.methodRef.textContext = 'xxx'
// this.objRef.current.textContext = 'xxx'

// 第三种使用方式需要在 Component 的构造函数中使用 createRef 这个 api 来指定一个属性挂载 ref 对象
// createRef 函数返回的结果是一个包含 current 的对象 { current: null }
// this.objRef = React.createRef() 