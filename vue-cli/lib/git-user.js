// exec command, 可以同步执行shell命令
const exec = require('child_process').execSync

module.exports = () => {
  let name
  let email

  try {
    // exec 获取的结果是 <Buffer >
    name = exec('git config --get user.name')
    email = exec('git config --get user.email')
  } catch (e) { }
  // JSON.stringify(name.toString().trim())
  // email.toString().trim()
  // 调不调用 JSON.stringify 在 mac 上差不多
  name = name && JSON.stringify(name.toString().trim()).slice(1, -1)
  email = email && (' <' + email.toString().trim() + '>')
  return (name || '') + (email || '')
}
