/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}

// 将 text 文本中的变量模板替换为实际的变量表达式
export function parseText(
  text: string,
  delimiters?: [string, string]
): TextParseResult | void {
  // defaultTagRE 就是默认的 {{ }} 模板变量字符串， 在 vuejs 中 {{}} 可以被替换成开发者自定义的模板，也就是这里的 buildRegex 
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  // 如果字符串中不存在 Mustache 标签语法的话，直接返回。
  if (!tagRE.test(text)) {
    return
  }
  const tokens = []
  const rawTokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index, tokenValue
  while ((match = tagRE.exec(text))) {
    index = match.index // tagRE 匹配中的字符串在 text 字符串中开始的位置
    // push text token
    // 存在 Mustache 标签
    if (index > lastIndex) {
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      // 先把变量左边的文本添加到数组中
      tokens.push(JSON.stringify(tokenValue))
    }
    // tag token
    // 匹配过滤器
    const exp = parseFilters(match[1].trim())
    // 把变量改成_s(x)这样的形式也添加到数组中
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    // 设置lastIndex来保证下一轮循环时，正则表达式不再重复匹配已经解析过的文本
    lastIndex = index + match[0].length
  }
  // 当所有变量都处理完毕后，如果最后一个变量右边还有文本，就将文本添加到数组中
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
  }
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}
