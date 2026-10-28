import { iframeDefine } from './iframe';
import { le5leMeta2dDefine } from './le5le-meta2d';
import { videoDefine } from './video';

/**
 * 仅在浏览器主线程注册的内置 HTML 图元。
 *
 * 该文件不能从 diagrams/index.ts 或 base/index.ts 引入，因为这两个入口
 * 会被 render、calc、hover Worker 静态加载，而 Worker 没有 DOM API。
 */
export const baseElementDefines = [videoDefine, iframeDefine, le5leMeta2dDefine];
