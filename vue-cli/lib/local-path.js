const path = require('path')

module.exports = {
  isLocalPath(templatePath) {
    // todo: 正则，好难受
    return /^[./]|(^[a-zA-Z]:)/.test(templatePath)
  },

  getTemplatePath(templatePath) {
    return path.isAbsolute(templatePath)
      ? templatePath
      // process.cwd() 当前命令的路径
      // todo: normalize ?
      : path.normalize(path.join(process.cwd(), templatePath))
  }
}
