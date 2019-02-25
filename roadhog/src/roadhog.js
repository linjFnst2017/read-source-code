import chalk from 'chalk';
// 衍生一个新的 Node.js 进程
import { fork } from 'child_process';

// TODO:: 退出命令行 ？？？
require('graceful-process')({ logLevel: 'warn' });

const script = process.argv[2];
// 从下标为3开始
// roadhog xxx argv xxx ?
const args = process.argv.slice(3);

// 获取node版本
const nodeVersion = process.versions.node;
const versions = nodeVersion.split('.');
// 大版本号
const major = versions[0];
// 小版本号
const minor = versions[1];

if (major * 10 + minor * 1 < 65) {
  console.log(`Node version must >= 6.5, but got ${major}.${minor}`);
  // node 退出进程
  process.exit(1);
}

// 两种情况下 'exit' 事件会被触发：
// 显式调用 process.exit() 方法，使得 Node.js 进程即将结束；
// Node.js 事件循环数组中不再有额外的工作，使得 Node.js 进程即将结束。
// Notify update when process exits
const updater = require('update-notifier');
const pkg = require('../package.json');
// defer 延迟： 只有进程退出之后才会通知。
updater({ pkg: pkg }).notify({ defer: true });
// ![img](https://raw.githubusercontent.com/yeoman/update-notifier/HEAD/screenshot.png)

const scriptAlias = {
  server: 'dev',
};
// roadhog server 命令转化 dev
const aliasedScript = scriptAlias[script] || script;
switch (aliasedScript) {
  case '-v':
  case '--version':
    const pkg = require('../package.json');
    console.log(pkg.version);
    if (!(pkg._from && pkg._resolved)) {
      console.log(chalk.cyan('@local'));
    }
    break;
  case 'build':
  case 'dev':
  case 'test':
    // TODO:: atool-monitor ???
    require('atool-monitor').emit();
    const proc = fork(
      require.resolve(`../lib/scripts/${aliasedScript}`),
      args,
      {
        stdio: 'inherit',
      },
    );
    // 退出新的子进程
    proc.once('exit', code => {
      // 退出 process 进程
      process.exit(code);
    });
    // TODO:: 这里关闭进程的逻辑不是很懂。 ？？？
    process.once('exit', () => {
      proc.kill();
    });
    break;
  default:
    console.log(`Unknown script ${chalk.cyan(script)}.`);
    break;
}
