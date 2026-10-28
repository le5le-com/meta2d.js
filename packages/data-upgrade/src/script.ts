/** 将旧版脚本中的 Meta2d 参数名迁移为 2.0 版本格式。 */
export function upgradeScript(script?: string): string | undefined {
  console.log("进入升级脚本函数", script);
  if (!script) {
    return script;
  }

  // 跳过注释和字符串内容，仅转换参数属性，避免误改 window.history 和普通文案。
  // ponytail: doEvent 仅处理布尔字面量；表达式及模板插值中的迁移需要语法解析器。
  const pattern = new RegExp(
    [
      String.raw`//[^\r\n]*|/\*[\s\S]*?\*/`,
      String.raw`(\bdoEvent\b|'doEvent'|"doEvent")(\s*:\s*)(true|false)(?=\s*[,}])`,
      String.raw`(\bhistory\b|'history'|"history")(\s*:)`,
      String.raw`"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'`,
      '`(?:\\\\[\\s\\S]|[^`\\\\])*`',
    ].join('|'),
    'g',
  );

  return script.replace(pattern, (match, eventKey, separator, value, historyKey, colon) => {
    if (eventKey) {
      // doEvent 与 preventEvent 语义相反，因此需要同步反转布尔值。
      return eventKey.replace('doEvent', 'preventEvent') + separator + (value === 'false' ? 'true' : 'false');
    }
    return historyKey ? historyKey.replace('history', 'record') + colon : match;
  });
}
