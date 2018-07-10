const request = require('request')
// semver: 用于比较版本号
const semver = require('semver')
const chalk = require('chalk')
const packageConfig = require('../package.json')

module.exports = done => {
  // 确保使用最小支持的node版本
  // process.version: 当前运行的node版本
  // packageConfig.engines.node: 依赖所需的node版本需要在 package.json 中标明
  // semver.satisfies('1.2.3', '1.x || >=2.5.0 || 5.0.0 - 7.2.3') 判断第一个参数的版本号满不满足条件
  if (!semver.satisfies(process.version, packageConfig.engines.node)) {
    return console.log(chalk.red(
      '  You must upgrade node to >=' + packageConfig.engines.node + '.x to use vue-cli'
    ))
  }

  request({
    url: 'https://registry.npmjs.org/vue-cli',
    timeout: 1000
  }, (err, res, body) => {
    if (!err && res.statusCode === 200) {
      // 获取最新版本的 vue-cli
      // postman请求得到的body是res对象的body
      const latestVersion = JSON.parse(body)['dist-tags'].latest
      // 当前安装的版本从 package.json 中读取
      const localVersion = packageConfig.versio
      // semver Comparison:
      // gt(v1, v2): v1 > v2
      // lt(v1, v2): v1 < v2
      if (semver.lt(localVersion, latestVersion)) {
        console.log(chalk.yellow('  A newer version of vue-cli is available.'))
        console.log()
        console.log('  latest:    ' + chalk.green(latestVersion))
        console.log('  installed: ' + chalk.red(localVersion))
        console.log()
      }
    }
    // 校验版本是否最新之后执行的回调函数
    done()
  })
}
