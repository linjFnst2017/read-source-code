function createThunkMiddleware(extraArgument) {
  return ({ dispatch, getState }) => next => action => {
    // 实际从 applyMiddleware(thunk)后，这里的 next 参数，在实际调用的时候值是 store.dispatch
    if (typeof action === 'function') {
      return action(dispatch, getState, extraArgument);
    }
    // 如果是一般的 action（不是 action creator）直接 dispatch
    return next(action);
  }
}

const thunk = createThunkMiddleware();
thunk.withExtraArgument = createThunkMiddleware;

export default thunk;
