// 在生产中的错误,提供开发中通用错误的描述
import invariant from 'invariant';
import { isArray, isFunction, isPlainObject } from './utils';

export default function checkModel(model, existModels) {
  const {
    namespace,
    reducers,
    effects,
    subscriptions,
  } = model;

  // namespace 必须被定义
  invariant(
    namespace,
    `[app.model] namespace should be defined`,
  );
  // 并且是字符串
  invariant(
    typeof namespace === 'string',
    `[app.model] namespace should be string, but got ${typeof namespace}`,
  );
  // 并且唯一
  // TODO:
  // existModels 是个什么方法， 感觉肯定不会出现有多个namespace的情况，string 应该会覆盖吧？
  invariant(
    !existModels.some(model => model.namespace === namespace),
    `[app.model] namespace should be unique`,
  );

  // state 可以为任意值

  // reducers 可以为空，PlainObject（简单对象） 或者数组
  if (reducers) {
    invariant(
      isPlainObject(reducers) || isArray(reducers),
      `[app.model] reducers should be plain object or array, but got ${typeof reducers}`,
    );
    // 数组的 reducers 必须是 [Object, Function] 的格式
    invariant(
      !isArray(reducers) || (isPlainObject(reducers[0]) && isFunction(reducers[1])),
      `[app.model] reducers with array should be [Object, Function]`,
    );
  }

  // effects 可以为空，PlainObject
  // TODO:
  // redux-saga 的 effects， 用于异步操作
  if (effects) {
    invariant(
      isPlainObject(effects),
      `[app.model] effects should be plain object, but got ${typeof effects}`,
    );
  }

  // TODO:
  // subscriptions 印象里 有点类似与生命周期函数
  if (subscriptions) {
    // subscriptions 可以为空，PlainObject
    invariant(
      isPlainObject(subscriptions),
      `[app.model] subscriptions should be plain object, but got ${typeof subscriptions}`,
    );

    // subscription 必须为函数
    invariant(
      isAllFunction(subscriptions),
      `[app.model] subscription should be function`,
    );
  }
}

function isAllFunction(obj) {
  return Object.keys(obj).every(key => isFunction(obj[key]));
}
