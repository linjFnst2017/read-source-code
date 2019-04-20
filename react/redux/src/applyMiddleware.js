// 依次多重操作的函数
import compose from './compose'

// applyMiddleware(thunk, logger ...) 
// 比如这样传参，最终得到 (arguments) => thunk(logger(arguments)) 这样一个函数

export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    const store = createStore(...args)
    let dispatch = () => {
      throw new Error(
        `Dispatching while constructing your middleware is not allowed. ` +
        `Other middleware would not be applied to this dispatch.`
      )
    }

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args)
    }
    // middleware: thunk ==> thunk(middlewareAPI) ==> 返回一个 next 函数为参数的函数
    // 所以这里 chain 是一个包含若干个 以 next 函数为参数的函数的数组
    const chain = middlewares.map(middleware => middleware(middlewareAPI))
    // 这里的 store.dispatch 就是 next 参数的实参， 而compose函数目的在于将每一个中间件返回的函数柯里化
    // 柯里化的实际意义是： 从右到左依次对参数进行调用。
    // 从 thunk 源码中可以看到， compose(...chain)(store.dispatch) 返回的结果是 一个 以 action 为参数的函数
    dispatch = compose(...chain)(store.dispatch)

    // 最终的 dispatch 已经是一个以action为参数 

    return {
      ...store,
      dispatch
    }
  }
}
