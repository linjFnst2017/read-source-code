// 简单判断就是，是否这个对象中含有一个 then 函数。
import isPromise from 'is-promise';
import { isFSA } from 'flux-standard-action';

export default function promiseMiddleware({ dispatch }) {
  // TODO:
  // next 指什么？
  return next => action => {
    // 
    if (!isFSA(action)) {
      return isPromise(action) ? action.then(dispatch) : next(action);
    }

    // 如果是一个标准的 action， payload 有可能是一个 promise ？
    return isPromise(action.payload)
      ? action.payload
        .then(result => dispatch({ ...action, payload: result }))
        .catch(error => {
          dispatch({ ...action, payload: error, error: true });
          return Promise.reject(error);
        })
      : next(action);
  };
}
