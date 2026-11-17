let revision = 0;

/** Worker 的字体描述缓存可能保留加载前的回退结果，成功加载后切换缓存键。 */
export function invalidateFontCache() {
  if (typeof document === 'undefined') {
    revision++;
  }
}

/** 追加不存在的末尾候选字体，仅改变缓存键，不改变原字体列表的优先级。 */
export function fontCacheSuffix() {
  return revision ? `, "__meta2d_font_revision_${revision}__"` : '';
}
