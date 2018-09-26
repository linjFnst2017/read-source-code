// 判断是否在浏览器中。
import { inBrowser } from './env'

// TODO:
// 不知道代表什么意思
export let mark
export let measure

if (process.env.NODE_ENV !== 'production') {
  // TODO:
  // window.performance 不知道做了什么工作
  const perf = inBrowser && window.performance
  /* istanbul ignore if */
  if (
    perf &&
    perf.mark &&
    perf.measure &&
    perf.clearMarks &&
    perf.clearMeasures
  ) {
    mark = tag => perf.mark(tag)
    measure = (name, startTag, endTag) => {
      perf.measure(name, startTag, endTag)
      perf.clearMarks(startTag)
      perf.clearMarks(endTag)
      perf.clearMeasures(name)
    }
  }
}
