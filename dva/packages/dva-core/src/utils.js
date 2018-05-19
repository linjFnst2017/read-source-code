
// 如果一个对象是由对象的构造函数创建的就返回 true
// https://www.npmjs.com/package/is-plain-object
export isPlainObject from 'is-plain-object';
// todo
// 这个写法看不懂
export const isArray = Array.isArray.bind(Array);
// todo
// 判断 function
// 通常会以 Object.prototype.toString.call(fn)=== '[object Function]'; 来判断是否是 function
export const isFunction = o => typeof o === 'function';
export const returnSelf = m => m;
// todo
// 等待 ? 无操作 ?
export const noop = () => {};
