// monaco代码提示类型管理
export class MonacoTypeManager {
  private monaco: any;
  constructor(monacoInstance) {
    this.monaco = monacoInstance;
  }

   loadTypeFile(path: string,callback) {
    fetch(path)
        .then(response => response.text())
        .then(data => {
          this.registerTypeFile(data)
          callback()
        })
        .catch(error => {
          console.error('Error fetching type file:', error);
        });
   }

  /**
   * 加载并注册 .d.ts 文件内容
   * @param {string} typeContent - 类型声明字符串内容
   * @param {string} filePath - 唯一虚拟文件路径
   */
  registerTypeFile(typeContent) {
    this.monaco.languages.typescript.javascriptDefaults.addExtraLib(
        typeContent,
    );
  }

  clearTypeFiles() {
    this.monaco.languages.typescript.javascriptDefaults.setExtraLibs([]);
  }

  /**
   * 为指定变量生成类型声明并注入
   * @param {string} varName - 变量名，例如 ctx
   * @param {string} typeName - 类型名，例如 CanvasRenderingContext2D
   */
  injectVariableType(varName, typeName) {
    // const filePath = `file:///injected-types/${varName}.d.ts`;
    const typeContent = `
      /** @type {${typeName}} */
      var ${varName};
    `;
    this.registerTypeFile(typeContent);
  }

  /**
   * 批量注册变量类型
   * @param {Array<{ varName: string, typeName: string }>} typeList
   */
  injectMultipleVariables(typeList) {
    typeList.forEach(({ varName, typeName }) => {
      this.injectVariableType(varName, typeName);
    });
  }
}
export const getPenAnimations = (idOrTag?: string) => {
  
};
