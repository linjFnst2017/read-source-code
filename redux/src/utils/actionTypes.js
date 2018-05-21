/**
 * These are private action types reserved(保留的) by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference(参考) these action types directly in your code.
 */

const randomString = () =>
  // 0.0 ~ 1.0 之间的一个伪随机数。
  Math.random()
    // 指定进制形式 36位
    .toString(36)
    // 截取
    .substring(7)
    .split('')
    .join('.')

// todo
// 为什么这三个action 需要加上随机的字符串？ 防止重复么？
const ActionTypes = {
  INIT: `@@redux/INIT${randomString()}`,
  REPLACE: `@@redux/REPLACE${randomString()}`,
  PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
}

export default ActionTypes
