/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { Fiber } from './ReactFiber';
import type { FiberRoot } from './ReactFiberRoot';
import type {
  Instance,
    TextInstance,
    Container,
    PublicInstance,
} from './ReactFiberHostConfig';
import type { ReactNodeList } from 'shared/ReactTypes';
import type { ExpirationTime } from './ReactFiberExpirationTime';

import {
  findCurrentHostFiber,
  findCurrentHostFiberWithNoPortals,
} from 'react-reconciler/reflection';
import { get as getInstance } from 'shared/ReactInstanceMap';
import { HostComponent, ClassComponent } from 'shared/ReactWorkTags';
import getComponentName from 'shared/getComponentName';
import invariant from 'shared/invariant';
import warningWithoutStack from 'shared/warningWithoutStack';
import ReactSharedInternals from 'shared/ReactSharedInternals';

// TODO: 实际这个 ReactFiberHostConfig 文件中并没有 getPublicInstance 函数
import { getPublicInstance } from './ReactFiberHostConfig';
import {
  findCurrentUnmaskedContext,
  processChildContext,
  emptyContextObject,
  isContextProvider as isLegacyContextProvider,
} from './ReactFiberContext';
import { createFiberRoot } from './ReactFiberRoot';
import { injectInternals } from './ReactFiberDevToolsHook';
import {
  computeUniqueAsyncExpiration,
  requestCurrentTime,
  computeExpirationForFiber,
  scheduleWork,
  flushRoot,
  batchedUpdates,
  unbatchedUpdates,
  flushSync,
  flushControlled,
  deferredUpdates,
  syncUpdates,
  interactiveUpdates,
  flushInteractiveUpdates,
  flushPassiveEffects,
} from './ReactFiberScheduler';
import { createUpdate, enqueueUpdate } from './ReactUpdateQueue';
import ReactFiberInstrumentation from './ReactFiberInstrumentation';
import {
  getStackByFiberInDevAndProd,
  phase as ReactCurrentFiberPhase,
  current as ReactCurrentFiberCurrent,
} from './ReactCurrentFiber';
import { StrictMode } from './ReactTypeOfMode';
import { Sync } from './ReactFiberExpirationTime';

type OpaqueRoot = FiberRoot;

// 0 is PROD, 1 is DEV.
// Might add PROFILE later.
type BundleType = 0 | 1;

type DevToolsConfig = {|
  bundleType: BundleType,
    version: string,
      rendererPackageName: string,
        // Note: this actually *does* depend on Fiber internal fields.
        // Used by "inspect clicked DOM element" in React DevTools.
        findFiberByHostInstance ?: (instance: Instance | TextInstance) => Fiber,
        // Used by RN in-app inspector.
        // This API is unfortunately RN-specific.
        // TODO: Change it to accept Fiber instead and type it properly.
        getInspectorDataForViewTag ?: (tag: number) => Object,
|};

let didWarnAboutNestedUpdates;
let didWarnAboutFindNodeInStrictMode;

if (__DEV__) {
  didWarnAboutNestedUpdates = false;
  didWarnAboutFindNodeInStrictMode = {};
}

function getContextForSubtree(
  parentComponent: ?React$Component<any, any>,
): Object {
  if (!parentComponent) {
    return emptyContextObject;
  }

  const fiber = getInstance(parentComponent);
  const parentContext = findCurrentUnmaskedContext(fiber);

  if (fiber.tag === ClassComponent) {
    const Component = fiber.type;
    if (isLegacyContextProvider(Component)) {
      return processChildContext(fiber, Component, parentContext);
    }
  }

  return parentContext;
}

// 安排根节点更新
function scheduleRootUpdate(
  current: Fiber,
  element: ReactNodeList,
  expirationTime: ExpirationTime,
  callback: ?Function,
) {
  if (__DEV__) {
    if (
      ReactCurrentFiberPhase === 'render' &&
      ReactCurrentFiberCurrent !== null &&
      !didWarnAboutNestedUpdates
    ) {
      didWarnAboutNestedUpdates = true;
      warningWithoutStack(
        false,
        'Render methods should be a pure function of props and state; ' +
        'triggering nested component updates from render is not allowed. ' +
        'If necessary, trigger nested updates in componentDidUpdate.\n\n' +
        'Check the render method of %s.',
        getComponentName(ReactCurrentFiberCurrent.type) || 'Unknown',
      );
    }
  }
  // {
  //   expirationTime: expirationTime,
  //   tag: UpdateState,
  //   payload: null,
  //   callback: null,
  //   next: null,
  //   nextEffect: null,
  // }
  // return 一个包含上面属性的 update 对象
  const update = createUpdate(expirationTime);
  // Caution: React DevTools currently depends on this property
  // being called "element".
  // 虚拟dom树放入payload  DevTools 需要这个属性。
  update.payload = { element };

  callback = callback === undefined ? null : callback;
  if (callback !== null) {
    warningWithoutStack(
      typeof callback === 'function',
      'render(...): Expected the last optional `callback` argument to be a ' +
      'function. Instead received: %s.',
      callback,
    );
    update.callback = callback;
  }

  flushPassiveEffects();
  // 将这个 update 加入更新队列中
  enqueueUpdate(current, update);
  // scheduleWork 是执行虚拟DOM（fiber树）的更新。 scheduleWork，requestWork, performWork 是三部曲
  scheduleWork(current, expirationTime);

  return expirationTime;
}

// 根据优先级更新容器 dom
export function updateContainerAtExpirationTime(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  // 超时时间， 前面计算出来的优先级
  expirationTime: ExpirationTime,
  callback: ?Function,
) {
  // TODO: If this is a nested container, this won't be the root.
  // 如果这是一个嵌套容器，那么这个就不是根。
  const current = container.current; // current 值是一个 Fiber

  if (__DEV__) {
    if (ReactFiberInstrumentation.debugTool) {
      if (current.alternate === null) {
        ReactFiberInstrumentation.debugTool.onMountContainer(container);
      } else if (element === null) {
        ReactFiberInstrumentation.debugTool.onUnmountContainer(container);
      } else {
        ReactFiberInstrumentation.debugTool.onUpdateContainer(container);
      }
    }
  }

  // 获取到父容器组件
  const context = getContextForSubtree(parentComponent);
  if (container.context === null) {
    // TODO:
    container.context = context;
  } else {
    container.pendingContext = context;
  }
  //安排根组件更新
  return scheduleRootUpdate(current, element, expirationTime, callback);
}

function findHostInstance(component: Object): PublicInstance | null {
  const fiber = getInstance(component);
  if (fiber === undefined) {
    if (typeof component.render === 'function') {
      invariant(false, 'Unable to find node on an unmounted component.');
    } else {
      invariant(
        false,
        'Argument appears to not be a ReactComponent. Keys: %s',
        Object.keys(component),
      );
    }
  }
  const hostFiber = findCurrentHostFiber(fiber);
  if (hostFiber === null) {
    return null;
  }
  return hostFiber.stateNode;
}

function findHostInstanceWithWarning(
  component: Object,
  methodName: string,
): PublicInstance | null {
  if (__DEV__) {
    const fiber = getInstance(component);
    if (fiber === undefined) {
      if (typeof component.render === 'function') {
        invariant(false, 'Unable to find node on an unmounted component.');
      } else {
        invariant(
          false,
          'Argument appears to not be a ReactComponent. Keys: %s',
          Object.keys(component),
        );
      }
    }
    const hostFiber = findCurrentHostFiber(fiber);
    if (hostFiber === null) {
      return null;
    }
    if (hostFiber.mode & StrictMode) {
      const componentName = getComponentName(fiber.type) || 'Component';
      if (!didWarnAboutFindNodeInStrictMode[componentName]) {
        didWarnAboutFindNodeInStrictMode[componentName] = true;
        if (fiber.mode & StrictMode) {
          warningWithoutStack(
            false,
            '%s is deprecated in StrictMode. ' +
            '%s was passed an instance of %s which is inside StrictMode. ' +
            'Instead, add a ref directly to the element you want to reference.' +
            '\n%s' +
            '\n\nLearn more about using refs safely here:' +
            '\nhttps://fb.me/react-strict-mode-find-node',
            methodName,
            methodName,
            componentName,
            getStackByFiberInDevAndProd(hostFiber),
          );
        } else {
          warningWithoutStack(
            false,
            '%s is deprecated in StrictMode. ' +
            '%s was passed an instance of %s which renders StrictMode children. ' +
            'Instead, add a ref directly to the element you want to reference.' +
            '\n%s' +
            '\n\nLearn more about using refs safely here:' +
            '\nhttps://fb.me/react-strict-mode-find-node',
            methodName,
            methodName,
            componentName,
            getStackByFiberInDevAndProd(hostFiber),
          );
        }
      }
    }
    return hostFiber.stateNode;
  }
  return findHostInstance(component);
}

// 创建容器
export function createContainer(
  // 实际 dom 节点
  containerInfo: Container,
  isConcurrent: boolean,
  hydrate: boolean,
): OpaqueRoot {
  // 创建 FiberRoot
  return createFiberRoot(containerInfo, isConcurrent, hydrate);
}

export function updateContainer(
  // 虚拟 dom 对象
  element: ReactNodeList,
  // fiber root
  container: OpaqueRoot,
  // null parentComponent 之类的
  parentComponent: ?React$Component<any, any>,
  // reactWork._onCommit
  callback: ?Function,
): ExpirationTime {
  // createFiberRoot 中创建的fiber对象
  const current = container.current;
  const currentTime = requestCurrentTime();
  // 计算优先级
  const expirationTime = computeExpirationForFiber(currentTime, current);
  // 根据优先级更新容器 dom
  return updateContainerAtExpirationTime(
    element,
    container,
    parentComponent,
    expirationTime,
    callback,
  );
}

export {
  flushRoot,
  computeUniqueAsyncExpiration,
  batchedUpdates,
  unbatchedUpdates,
  deferredUpdates,
  syncUpdates,
  interactiveUpdates,
  flushInteractiveUpdates,
  flushControlled,
  flushSync,
  flushPassiveEffects,
};

// 获取公共的根实例
export function getPublicRootInstance(
  // 参数是一个 FiberRoot 实例
  container: OpaqueRoot,
): React$Component<any, any> | PublicInstance | null {
  // current 值是一个未初始化的 Fiber, 即是一个创建 FiberNode 节点的函数， 等待执行。
  // uninitializedFiber 是一个 FiberNode， 作为一个容器 container
  const containerFiber = container.current;
  // 父容器此时 child 应该为空。
  if (!containerFiber.child) {
    return null;
  }
  // containerFiber.child 应该也是一个 FiberNode 类型
  switch (containerFiber.child.tag) {
    // 主机组件
    case HostComponent:
      return getPublicInstance(containerFiber.child.stateNode);
    default:
      return containerFiber.child.stateNode;
  }
}

export { findHostInstance };

export { findHostInstanceWithWarning };

export function findHostInstanceWithNoPortals(
  fiber: Fiber,
): PublicInstance | null {
  const hostFiber = findCurrentHostFiberWithNoPortals(fiber);
  if (hostFiber === null) {
    return null;
  }
  return hostFiber.stateNode;
}

let shouldSuspendImpl = fiber => false;

export function shouldSuspend(fiber: Fiber): boolean {
  return shouldSuspendImpl(fiber);
}

let overrideHookState = null;
let overrideProps = null;
let scheduleUpdate = null;
let setSuspenseHandler = null;

if (__DEV__) {
  const copyWithSetImpl = (
    obj: Object | Array<any>,
    path: Array<string | number>,
    idx: number,
    value: any,
  ) => {
    if (idx >= path.length) {
      return value;
    }
    const key = path[idx];
    const updated = Array.isArray(obj) ? obj.slice() : { ...obj };
    // $FlowFixMe number or string is fine here
    updated[key] = copyWithSetImpl(obj[key], path, idx + 1, value);
    return updated;
  };

  const copyWithSet = (
    obj: Object | Array<any>,
    path: Array<string | number>,
    value: any,
  ): Object | Array<any> => {
    return copyWithSetImpl(obj, path, 0, value);
  };

  // Support DevTools editable values for useState and useReducer.
  overrideHookState = (
    fiber: Fiber,
    id: number,
    path: Array<string | number>,
    value: any,
  ) => {
    // For now, the "id" of stateful hooks is just the stateful hook index.
    // This may change in the future with e.g. nested hooks.
    let currentHook = fiber.memoizedState;
    while (currentHook !== null && id > 0) {
      currentHook = currentHook.next;
      id--;
    }
    if (currentHook !== null) {
      flushPassiveEffects();

      const newState = copyWithSet(currentHook.memoizedState, path, value);
      currentHook.memoizedState = newState;
      currentHook.baseState = newState;

      // We aren't actually adding an update to the queue,
      // because there is no update we can add for useReducer hooks that won't trigger an error.
      // (There's no appropriate action type for DevTools overrides.)
      // As a result though, React will see the scheduled update as a noop and bailout.
      // Shallow cloning props works as a workaround for now to bypass the bailout check.
      fiber.memoizedProps = { ...fiber.memoizedProps };

      scheduleWork(fiber, Sync);
    }
  };

  // Support DevTools props for function components, forwardRef, memo, host components, etc.
  overrideProps = (fiber: Fiber, path: Array<string | number>, value: any) => {
    flushPassiveEffects();
    fiber.pendingProps = copyWithSet(fiber.memoizedProps, path, value);
    if (fiber.alternate) {
      fiber.alternate.pendingProps = fiber.pendingProps;
    }
    scheduleWork(fiber, Sync);
  };

  scheduleUpdate = (fiber: Fiber) => {
    flushPassiveEffects();
    scheduleWork(fiber, Sync);
  };

  setSuspenseHandler = (newShouldSuspendImpl: Fiber => boolean) => {
    shouldSuspendImpl = newShouldSuspendImpl;
  };
}

export function injectIntoDevTools(devToolsConfig: DevToolsConfig): boolean {
  const { findFiberByHostInstance } = devToolsConfig;
  const { ReactCurrentDispatcher } = ReactSharedInternals;

  return injectInternals({
    ...devToolsConfig,
    overrideHookState,
    overrideProps,
    setSuspenseHandler,
    scheduleUpdate,
    currentDispatcherRef: ReactCurrentDispatcher,
    findHostInstanceByFiber(fiber: Fiber): Instance | TextInstance | null {
      const hostFiber = findCurrentHostFiber(fiber);
      if (hostFiber === null) {
        return null;
      }
      return hostFiber.stateNode;
    },
    findFiberByHostInstance(instance: Instance | TextInstance): Fiber | null {
      if (!findFiberByHostInstance) {
        // Might not be implemented by the renderer.
        return null;
      }
      return findFiberByHostInstance(instance);
    },
  });
}
