// 判断是否在浏览器中。
import { inBrowser } from './env'

export let mark
export let measure

if (process.env.NODE_ENV !== 'production') {
  // window.performance 一般用于前端性能监控方案中的一个 api
  const perf = inBrowser && window.performance
  /* istanbul ignore if */
  if (
    perf &&
    perf.mark &&
    perf.measure &&
    perf.clearMarks &&
    perf.clearMeasures
  ) {
    // perf.mark: 创建标记
    mark = tag => perf.mark(tag)
    measure = (name, startTag, endTag) => {
      // 记录两个标记的时间间隔, 以 name 为 key 存储
      perf.measure(name, startTag, endTag)
      // 清除指定标记
      perf.clearMarks(startTag)
      perf.clearMarks(endTag)
      // 清除指定记录间隔数据
      perf.clearMeasures(name)
    }
  }
}
