/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { Fiber } from './ReactFiber';
import type { ExpirationTime } from './ReactFiberExpirationTime';
import type { TimeoutHandle, NoTimeout } from './ReactFiberHostConfig';
import type { Thenable } from './ReactFiberScheduler';
import type { Interaction } from 'scheduler/src/Tracing';

import { noTimeout } from './ReactFiberHostConfig';
import { createHostRootFiber } from './ReactFiber';
import { NoWork } from './ReactFiberExpirationTime';
import { enableSchedulerTracing } from 'shared/ReactFeatureFlags';
import { unstable_getThreadID } from 'scheduler/tracing';

// TODO: This should be lifted into the renderer.
export type Batch = {
  _defer: boolean,
  _expirationTime: ExpirationTime,
  _onComplete: () => mixed,
  _next: Batch | null,
};

export type PendingInteractionMap = Map<ExpirationTime, Set<Interaction>>;

type BaseFiberRootProperties = {|
  // Any additional information from the host associated with this root.
  containerInfo: any,
    // Used only by persistent updates.
    pendingChildren: any,
      // The currently active root fiber. This is the mutable root of the tree.
      current: Fiber,

        pingCache:
    | WeakMap<Thenable, Set<ExpirationTime>>
    | Map<Thenable, Set<ExpirationTime>>
    | null,

    pendingCommitExpirationTime: ExpirationTime,
    // A finished work-in-progress HostRoot that's ready to be committed.
    finishedWork: Fiber | null,
    // Timeout handle returned by setTimeout. Used to cancel a pending timeout, if
    // it's superseded by a new one.
    timeoutHandle: TimeoutHandle | NoTimeout,
    // Top context object, used by renderSubtreeIntoContainer
    context: Object | null,
    pendingContext: Object | null,
    // Determines if we should attempt to hydrate on the initial mount
    +hydrate: boolean,
    // List of top-level batches. This list indicates whether a commit should be
    // deferred. Also contains completion callbacks.
    // TODO: Lift this into the renderer
    firstBatch: Batch | null,
    // Node returned by Scheduler.scheduleCallback
    callbackNode: *,
    // Expiration of the callback associated with this root
    callbackExpirationTime: ExpirationTime,
    // The earliest pending expiration time that exists in the tree
    firstPendingTime: ExpirationTime,
    // The latest pending expiration time that exists in the tree
    lastPendingTime: ExpirationTime,
    // The time at which a suspended component pinged the root to render again
    pingTime: ExpirationTime,
|};

// The following attributes are only used by interaction tracing builds.
// They enable interactions to be associated with their async work,
// And expose interaction metadata to the React DevTools Profiler plugin.
// Note that these attributes are only defined when the enableSchedulerTracing flag is enabled.
type ProfilingOnlyFiberRootProperties = {|
  interactionThreadID: number,
    memoizedInteractions: Set < Interaction >,
      pendingInteractionMap: PendingInteractionMap,
|};

// Exported FiberRoot type includes all properties,
// To avoid requiring potentially error-prone :any casts throughout the project.
// Profiling properties are only safe to access in profiling builds (when enableSchedulerTracing is true).
// The types are defined separately within this file to ensure they stay in sync.
// (We don't have to use an inline :any cast when enableSchedulerTracing is disabled.)
export type FiberRoot = {
  ...BaseFiberRootProperties,
  ...ProfilingOnlyFiberRootProperties,
};


// FiberRootNode 没有 child 的
// FiberNode 是有 child 的
function FiberRootNode(containerInfo, hydrate) {
  this.current = null;
  this.containerInfo = containerInfo;
  this.pendingChildren = null;
  this.pingCache = null;
  this.pendingCommitExpirationTime = NoWork;
  this.finishedWork = null;
  this.timeoutHandle = noTimeout;
  this.context = null;
  this.pendingContext = null;
  this.hydrate = hydrate;
  this.firstBatch = null;
  this.callbackNode = null;
  this.callbackExpirationTime = NoWork;
  this.firstPendingTime = NoWork;
  this.lastPendingTime = NoWork;
  this.pingTime = NoWork;

  if (enableSchedulerTracing) {
    this.interactionThreadID = unstable_getThreadID();
    this.memoizedInteractions = new Set();
    this.pendingInteractionMap = new Map();
  }
}

export function createFiberRoot(
  // 默认状态下 id = app 的 dom
  containerInfo: any,
  // 并发 or 同步
  isConcurrent: boolean, // 默认会是 false
  hydrate: boolean, // 客户端渲染默认应该也是一个 false 
): FiberRoot {
  const root: FiberRoot = (new FiberRootNode(containerInfo, hydrate): any);

  // Cyclic construction. This cheats the type system right now because
  // stateNode is any.
  // 循环结构。这就欺骗了类型系统，因为stateNode是any。
  // 未初始化的 Fiber 结构。值是一个 createFiber 函数，该函数用于创建一个 FiberNode 节点
  const uninitializedFiber = createHostRootFiber(isConcurrent);
  // current 值是一个 fiber， 即使当前是一个未初始化结构的 fiber。 这个属性是 React 的核心。
  root.current = uninitializedFiber;
  // TODO: 循环指向，后面需要互相引用么？ 静态节点与根节点之间？
  uninitializedFiber.stateNode = root;

  return root;
}
