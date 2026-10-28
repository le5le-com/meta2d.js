import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist');

function walkDir(dir, callback) {
  readdirSync(dir).forEach(f => {
    const dirPath = join(dir, f);
    const isDirectory = statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(join(dir, f));
  });
}

walkDir(distDir, (filePath) => {
  if (filePath.endsWith('.js')) {
    let content = readFileSync(filePath, 'utf-8');
    // 匹配 new URL('./xxx.ts', import.meta.url) 模式
    const regex = /new URL\((['"])([^'"]+)\.ts\1,\s*import\.meta\.url\)/g;
    content = content.replace(regex, 'new URL($1$2.js$1, import.meta.url)');
    writeFileSync(filePath, content);
  }
});

console.log('Worker paths in dist have been rewritten from .ts to .js');
