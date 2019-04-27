/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { REACT_FORWARD_REF_TYPE, REACT_MEMO_TYPE } from 'shared/ReactSymbols';

import warningWithoutStack from 'shared/warningWithoutStack';

export default function forwardRef<Props, ElementType: React$ElementType>(
  render: (props: Props, ref: React$Ref<ElementType>) => React$Node,
) {
  if (__DEV__) {
    if (render != null && render.$$typeof === REACT_MEMO_TYPE) {
      warningWithoutStack(
        false,
        'forwardRef requires a render function but received a `memo` ' +
        'component. Instead of forwardRef(memo(...)), use ' +
        'memo(forwardRef(...)).',
      );
    } else if (typeof render !== 'function') {
      warningWithoutStack(
        false,
        'forwardRef requires a render function but was given %s.',
        render === null ? 'null' : typeof render,
      );
    } else {
      warningWithoutStack(
        // Do not warn for 0 arguments because it could be due to usage of the 'arguments' object
        render.length === 0 || render.length === 2,
        'forwardRef render functions accept exactly two parameters: props and ref. %s',
        render.length === 1
          ? 'Did you forget to use the ref parameter?'
          : 'Any additional parameter will be undefined.',
      );
    }

    if (render != null) {
      warningWithoutStack(
        render.defaultProps == null && render.propTypes == null,
        'forwardRef render functions do not support propTypes or defaultProps. ' +
        'Did you accidentally pass a React component?',
      );
    }
  }

  return {
    // 看到这里的 $$typeof 不要太激动，并不是说这里通过 forwardRef 函数创建的组件的 $$typeof 都是 REACT_FORWARD_REF_TYPE 了，看最下面的 demo 代码
    // TargetComponent 组件的值是 forwardRef 函数返回的，是一个对象。 也就是说，render 函数中 return 部分的标签，是作为 createElement 的第一个参数传入的
    // 也就是说这里的 function component 被渲染的时候还是通过 createElement 函数创建的， $$typeof 还是 REACT_ELEMENT_TYPE 只不过是参数 type 变成了 
    // 这里 return 出去的对象 { $$typeof, render }
    $$typeof: REACT_FORWARD_REF_TYPE,
    // 真正的渲染函数
    render,
  };
}


// function component 可以看成是一个 purecomponent， 它是没有实例的。所以如果在 function component 上给了一个 ref 标签
// 需要通过 React.forwardRef 函数传入一个拥有两个参数的函数作为参数，被传入的函数的第二个参数就是 ref 传递给接下去需要渲染的内容。
// 如果需要做一个 hoc 组件，可以拿到这个 ref 之后传递出去，否则就会违反开发者的意图，不使用  React.forwardRef  的话，
// 我理解拿到的是包装以后的 hoc 组件，而不是被包装的组件
// const TargetComponent = React.forwardRef((props, ref) => (< input type="text" ref={ref} />))
// export default class Comp extends React.Component {
//   constructor() {
//     super()
//     this.ref = React.createRef()
//   }
//   componentDidMount() {
//     this.ref.current.value = 'hahaha'
//   }
//   render() {
//     return <TargetComponent ref={this.ref} />
//   }
// }