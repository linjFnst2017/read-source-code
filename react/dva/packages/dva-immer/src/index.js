// Create the next immutable state tree by simply modifying the current tree
// 通过简单修改当前的 state 树来创建一个不可变的 state 树
// 替代 immutable
import produce from 'immer';

export default function() {
  return {
    _handleActions(handlers, defaultState) {
      return (state = defaultState, action) => {
        const { type } = action;
        const ret = produce(state, draft => {
          const handler = handlers[type];
          if (handler) {
            handler(draft, action);
          }
        });
        return ret === undefined ? {} : ret;
      };
    },
  };
}
