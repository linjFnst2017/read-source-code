import warning from 'warning';
import { isArray } from './utils';
import { NAMESPACE_SEP } from './constants';

// prefix 前缀
function prefix(obj, namespace, type) {
  // TODO:
  // 将 obj 中的对象的所有键加上前缀
  // memo 所有 key 添加前缀之后的对象
  // memo 的初始值是 {}
  return Object.keys(obj).reduce((memo, key) => {
    warning(
      key.indexOf(`${namespace}${NAMESPACE_SEP}`) !== 0,
      `[prefixNamespace]: ${type} ${key} should not be prefixed with namespace ${namespace}`,
    );
    const newKey = `${namespace}${NAMESPACE_SEP}${key}`;
    memo[newKey] = obj[key];
    return memo;
  }, {});
}

export default function prefixNamespace(model) {
  const {
    namespace,
    reducers,
    effects,
  } = model;

  // 简单理解为将每一个 model 的 reducers 和 effects 加上 namespace 前缀
  // TODO:
  // 为什么 subscriptions 和 state 不需要加 namespace 前缀 ?
  if (reducers) {
    // checkModels 中说明了reducers 可以为简单对象或者数组
    // 如果 reducers 是数组的话, 简单获取数组的第一个值进行前缀操作
    if (isArray(reducers)) {
      model.reducers[0] = prefix(reducers[0], namespace, 'reducer');
    } else {
      model.reducers = prefix(reducers, namespace, 'reducer');
    }
  }
  if (effects) {
    model.effects = prefix(effects, namespace, 'effect');
  }
  return model;
}
