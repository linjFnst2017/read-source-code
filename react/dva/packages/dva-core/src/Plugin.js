import invariant from 'invariant';
// jQuery的官方定义：含有零个或多个的key/value对
// 排除 typeof xx 是 object 但非简单对象的情况
import { isPlainObject } from './utils';

// 钩子函数
const hooks = [
  'onError',
  'onStateChange',
  'onAction',
  'onHmr',
  'onReducer',
  'onEffect',
  'extraReducers',
  'extraEnhancers',
  '_handleActions',
];

// 过滤掉 obj 定义的非 hooks 枚举出的钩子函数
export function filterHooks(obj) {
  return Object.keys(obj).reduce((memo, key) => {
    if (hooks.indexOf(key) > -1) {
      memo[key] = obj[key];
    }
    return memo;
  }, {});
}

// plugin = { _handleActions: null,  hooks: { onError: [], ...}}
export default class Plugin {
  constructor() {
    this._handleActions = null;
    // 将常量 hooks 中声明的钩子函数名 每一个都扩展为一个空数组
    this.hooks = hooks.reduce((memo, key) => {
      memo[key] = [];
      return memo;
    }, {});
  }

  use(plugin) {
    invariant(
      isPlainObject(plugin),
      'plugin.use: plugin should be plain object',
    );
    // TODO:
    // 这里不是简单的声明一个常量hooks, 下面对于 hooks 的扩展和改变都会影响 plugin 对象中的 hooks 属性的.
    // 所以这里其实是 用了对象扩展
    const hooks = this.hooks;
    for (const key in plugin) {
      // 使用call,参数列表得像普通函数调用一样，一定要一个一个的列在后面
      // 使用apply，参数列表要使用数组，所以也可以传arguments对象进去.
      // plugin.hasOwnProperty(key)
      // TODO:
      // for in 循环出对象的键 是否都是 hasOwnProperty ?
      if (Object.prototype.hasOwnProperty.call(plugin, key)) {
        invariant(hooks[key], `plugin.use: unknown plugin property: ${key}`);
        // TODO:
        // _handleActions 和 extraEnhancers 为啥要特殊对待?
        if (key === '_handleActions') {
          // TODO:
          // 这里的this 指向是 Plugin class 么?
          // hooks[_handleActions] 不需要了?
          this._handleActions = plugin[key];
        } else if (key === 'extraEnhancers') {
          // 覆盖 hooks.extraEnhancers = [] 的 空数组值
          hooks[key] = plugin[key];
        } else {
          // TODO:
          // 这里除了extraEnhancers 和 _handleActions 为什么就直接push了?
          // hooks[key] 的值 都是数组,所以直接 push  plugin 中对应的值
          hooks[key].push(plugin[key]);
        }
      }
    }
  }

  apply(key, defaultHandler) {
    const hooks = this.hooks;
    const validApplyHooks = ['onError', 'onHmr'];
    // TODO:
    // 只有 'onError', 'onHmr' 两个钩子函数能够被 apply ?
    invariant(
      validApplyHooks.indexOf(key) > -1,
      `plugin.apply: hook ${key} cannot be applied`,
    );
    const fns = hooks[key];

    // apply 函数的作用是 获取指定钩子函数, 如果没有获取到或者钩子函数还未定义,那么就调用默认的处理函数
    return (...args) => {
      // fns 数组
      if (fns.length) {
        for (const fn of fns) {
          fn(...args);
        }
      } else if (defaultHandler) {
        defaultHandler(...args);
      }
    };
  }

  get(key) {
    const hooks = this.hooks;
    // TODO:
    // key in hooks 判断 hooks 中是否存在 key 这个键 ?
    // 感觉这个方法很奇怪
    invariant(key in hooks, `plugin.get: hook ${key} cannot be got`);
    if (key === 'extraReducers') {
      return getExtraReducers(hooks[key]);
    } else if (key === 'onReducer') {
      return getOnReducer(hooks[key]);
    } else {
      return hooks[key];
    }
  }
}

// 获取临时的 Reducer 对象, 引用不一致
function getExtraReducers(hook) {
  let ret = {};
  for (const reducerObj of hook) {
    ret = { ...ret, ...reducerObj };
  }
  return ret;
}

// TODO:
// 感觉像是: 开启reducer ?
function getOnReducer(hook) {
  return function (reducer) {
    // 数组遍历 for of
    // for...of循环不会循环对象的key，只会循环出数组的value
    // 因此for...of不能循环遍历普通对象,对普通对象的属性遍历推荐使用for...in
    // TODO:
    // 这个函数是为了将所有的钩子函数都作用到 reducer 上么?
    for (const reducerEnhancer of hook) {
      reducer = reducerEnhancer(reducer);
    }
    return reducer;
  };
}
