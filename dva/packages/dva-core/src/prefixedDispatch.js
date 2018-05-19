import invariant from 'invariant';
import warning from 'warning';
import { NAMESPACE_SEP } from './constants';
import prefixType from './prefixType';

export default function prefixedDispatch(dispatch, model) {
  return (action) => {
    const { type } = action;
    invariant(type, 'dispatch: action should be a plain Object with type');
    warning(
      type.indexOf(`${model.namespace}${NAMESPACE_SEP}`) !== 0,
      `dispatch: ${type} should not be prefixed with namespace ${model.namespace}`,
    );
    // 尝试将 action 中的 type 转化成 带有 namespace 前缀的type
    return dispatch({ ...action, type: prefixType(type, model) });
  };
}
