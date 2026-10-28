const fs = require('fs');
const path = require('path');

// 修复 Worker 路径
function fixWorkerPaths() {
  const filePath = path.resolve(__dirname, '../dist/meta2d.js/meta2d.min.js');

  console.log('正在检查文件:', filePath);

  if (!fs.existsSync(filePath)) {
    console.error('❌ meta2d.min.js 文件不存在:', filePath);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // 查找并替换 Worker 路径引用
  // 将绝对路径的 Worker 引用改为相对路径
  const workerNames = [
    'meta2d.render.worker.js',
    'meta2d.calc.worker.js',
    'meta2d.hover.worker.js',
    'meta2d.utility.worker.js'
  ];

  let modified = false;

  workerNames.forEach(name => {
    // 匹配类似 "meta2d.render.worker.js" 或 '/meta2d.render.worker.js' 的引用
    const patterns = [
      new RegExp(`"/${name}"`, 'g'),
      new RegExp(`'/${name}'`, 'g'),
      new RegExp(`"${name}"`, 'g'),
      new RegExp(`'${name}'`, 'g'),
    ];

    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, `"./${name}"`);
        modified = true;
        console.log(`✅ 修复 ${name} 路径`);
      }
    });
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Worker 路径已修复');
  } else {
    console.log('ℹ️  未找到需要修复的 Worker 路径');
  }
}

fixWorkerPaths();
