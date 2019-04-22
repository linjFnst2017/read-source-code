/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 * 
 * 通过这段注释我们可以了解到，`Vue` 的 `html parser` 是 `fork` 自 [John Resig 所写的一个开源项目：
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js](http://erik.eae.net/simplehtmlparser/simplehtmlparser.js)，
 * `Vue` 在此基础上做了很多完善的工作，下面我们就探究一下 `Vue` 中的 `html parser` 都做了哪些事情。
 */

import { makeMap, no } from '../../shared/util'
import { isNonPhrasingTag } from '../../platforms/web/compiler/util'

// Regular Expressions for parsing tags and attributes
// 这个正则的作用是用来匹配标签的属性
// 第三、四、五个都表示匹配属性值，同时 `?` 表明第三、四、五个分组是可选的。 
// ([^\s"'<>\/=]+) 匹配属性名，排除 空格、引号、尖括号、斜杠、等于号
// (=) 匹配等于号
// (?:"([^"]*)  (?:pattern) 匹配 pattern 但不获取匹配结果，也就是说这是一个非获取匹配，不进行存储供以后使用。
// ([^']*)
// ([^\s"'=<>`]+)
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 这是因为在 `html` 标签中有4种写属性值的方式：
// * 1、使用双引号把值引起来：`class="some-class"`
// * 2、使用单引号把值引起来：`class='some-class'`
// * 3、不使用引号：`class=some-class`
// * 4、单独的属性名：`disabled`

// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
// `qname` 就是：`<前缀:标签名称>`，也就是合法的XML标签
// ncname` 的全称是 `An XML name that does not contain a colon (:)` 即：不包含冒号(`:`)的 XML 名称
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
// 以开始标签开始的模板 '<div></div>'.match(startTagOpen) // ["<div", "div", index: 0, input: "<div></div>"]
// 以结束标签开始的模板 '</div><div>我是Berwin</div>'.match(startTagOpen) // null
// 以文本开始的模板 '我是Berwin</p>'.match(startTagOpen) // null
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  IS_REGEX_CAPTURING_BROKEN = g === ''
})

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr(value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

// 词法分析函数
// 将 `html` 字符串作为字符输入流，并且按照一定的规则将其逐步消化分解
export function parseHTML(html, options) {
  // 定义一些常量和变量
  // stack 栈是用来处理标签的父子关系。 每次解析出一个开始标签，就压入;解析出结束标签就弹出一个 stack 中的标签; 解析出其他的标签， 就将当前最新的
  // stack 顶的标签的 children 设置为当前解析到的节点。
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag

  // 开启一个 while 循环，循环结束的条件是 html 为空，即 html 被 parse 完毕。html变量是HTML模板
  // 模板是一小段一小段去截取与解析的，所以需要一个循环来不断截取，直到全部截取完毕
  while (html) {
    last = html
    // 首先要判断父元素是不是纯文本内容元素，因为不同类型父节点的解析方式将完全不同
    // Make sure we're not in a plaintext content element like script/style
    // 确保我们不是在像script/style这样的纯文本内容元素中
    if (!lastTag || !isPlainTextElement(lastTag)) {
      //  确保即将 parse 的内容不是在纯文本标签里 (script,style,textarea)
      let textEnd = html.indexOf('<')
      // 保证字符串的第一个字符是 < ,接下来才进行标签截取和匹配
      if (textEnd === 0) {
        // Comment:
        // 注释截取， 以 <!-- 开头
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')
          // 存在注释结束标签
          if (commentEnd >= 0) {
            // 注释的钩子函数可以通过选项来配置
            // 只有options.shouldKeepComment为真时，才会触发钩子函数，否则只截取模板，不触发钩子函数
            if (options.shouldKeepComment) {
              // 注释钩子函数
              options.comment(html.substring(4, commentEnd))
            }
            // 截取模板
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 通过这个逻辑可以发现，在Vue.js中条件注释其实没有用，写了也会被截取掉，通俗一点说就是写了也白写
        // <![if !IE]><link href="non-ie.css" rel="stylesheet"><![endif]>
        // 条件注释不需要触发钩子函数，我们只需要把它截取掉就行了
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')
          // 存在的话，直接截取
          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        // DOCTYPE与条件注释相同，都是不需要触发钩子函数的，只需要将匹配到的这一段字符截取掉即可
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          // 直接截取
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        // 结束标签匹配。
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          // 对模板字符串进行截取
          advance(endTagMatch[0].length)
          // 再出发钩子函数
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        // 开始标签匹配。调用parseStartTag就可以将剩余模板开始部分的开始标签解析出来。
        // 如果剩余HTML模板的开始部分不符合开始标签的正则表达式规则，那么调用parseStartTag就会返回undefined
        const startTagMatch = parseStartTag()
        // 如果调用它后得到了解析结果，那么说明剩余模板的开始部分符合开始标签的规则
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }
      }

      // 截取文本不需要经过正则表达式
      let text, rest, next
      // 截取文本， 剩余字符串中包含 < ，<之前的所有字符都是文本
      if (textEnd >= 0) {
        // 文本内容获取
        rest = html.slice(textEnd)
        while (
          // 如果文本的内容不符合开始标签、结束标签、注释标签、条件注释标签的话，就算在文本中还存在 < 字符，也认为是文本的一部分
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          // 如果'<'在纯文本中，将它视为纯文本对待
          // 获取第二个 < 字符的开始位置，前面的 < 字符被当做文本
          next = rest.indexOf('<', 1)
          // 如果没有的话，就算了，相当于当前的文本内容全都是
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        // 获取匹配到的文本
        text = html.substring(0, textEnd)
        // 截取已经匹配过的字符串
        advance(textEnd)
      }
      // 如果模板中找不到<，就说明整个模板都是文本
      if (textEnd < 0) {
        text = html
        html = ''
      }

      // 触发文本钩子函数
      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      // 纯文本内容元素的处理：script、style和textarea这三种元素叫作纯文本内容元素。解析它们的时候，会把这三种标签内包含的所有内容都当作文本处理
      // 父元素为 script、style、textarea 的处理逻辑
      // 即将 parse 的内容是在纯文本标签里 (script,style,textarea)
      let endTagLength = 0
      // lastTag 代表父元素，值是  script、style、textarea 
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      // 如果父标签是纯文本内容元素，那么本轮循环会一次性将这个父标签给处理完毕
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    // 将剩余的整个字符串作为文本对待
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // 调用 parseEndTag 函数
  // Clean up any remaining tags
  parseEndTag()

  function advance(n) {
    // 下标注明
    index += n
    // 截取已经匹配的 str
    html = html.substring(n)
  }

  // 解析开始标签
  function parseStartTag() {
    // '<div></div>'.match(startTagOpen)
    // ["<div", "div", index: 0, input: "<div></div>"]
    // 解析标签名，判断模板是否符合开始标签的特征
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1], // 标签名是正则表达式中匹配结果的第二个
        attrs: [],
        start: index // 开始 ？ index 一开始为 0
      }
      // 匹配结果数组的第一个是匹配到的完整内容
      advance(start[0].length)
      // 解析标签属性
      let end, attr
      // 如果不符合结尾标签，但是符合属性标签
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        // attr 匹配到的属性结果
        advance(attr[0].length)
        // 添加进定义的 match 对象中
        match.attrs.push(attr)
      }
      // 如果经过属性匹配之后，while 循环结束的条件应该是匹配到结束标签了。 判断是否为结束标签
      if (end) {
        // console.log(parseStartTagEnd('></div>')) // {unarySlash: ""}
        // console.log(parseStartTagEnd('/><div></div>')) // {unarySlash: "/"}
        // 自闭合标签解析后的unarySlash属性为/，而非自闭合标签为空字符串。
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  // 处理开始标签
  function handleStartTag(match) {
    // 将tagName、attrs和unary等数据取出来，然后调用钩子函数将这些数据放到参数中
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
    }

    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  // 解析结束标签
  function parseEndTag(tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    if (tagName) {
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
