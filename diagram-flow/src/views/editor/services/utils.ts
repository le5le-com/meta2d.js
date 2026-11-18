import type { Meta2d, Pen } from '@meta2d/core';

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
export interface TreeNode {
  label: string;
  id: string;
  value: string;
  children?: TreeNode[];
}

// 画布实例以 Web Component 形式挂载，调用时实时获取
const getMeta2d = () => document.querySelector('le5le-meta2d') as unknown as Meta2d | null;

const buildTreeData = (meta2d: Meta2d, pen: Pen): TreeNode => {
  const node: TreeNode = {
    label: pen.name || pen.type || pen.id,
    id: pen.id,
    value: pen.id,
  };
  if (pen.children?.length) {
    node.children = [];
    pen.children.forEach((childId: string) => {
      const child = meta2d.penMap.get(childId);
      if (child) {
        node.children!.push(buildTreeData(meta2d, child));
      }
    });
  }
  return node;
};

// 图元树（用于选择动作目标图元）
export const getPenTree = (): TreeNode[] => {
  const meta2d = getMeta2d();
  if (!meta2d) {
    return [];
  }
  const pens = Array.from(meta2d.penMap.values());
  return pens.filter((pen) => !pen.parentId).map((pen) => buildTreeData(meta2d, pen));
};

// 所有图元的标签（即“组”）
export const getGroups = () => {
  const meta2d = getMeta2d();
  if (!meta2d) {
    return [];
  }
  const groups = new Set<string>();
  meta2d.penMap.forEach((pen) => {
    pen.tags?.forEach((tag) => groups.add(tag));
  });
  return Array.from(groups).map((group) => ({ label: group, value: group }));
};

// 获取目标图元（缺省为当前选中图元）的动画名称列表
export const getPenAnimations = (idOrTag?: string): string[] => {
  const meta2d = getMeta2d();
  if (!meta2d) {
    return [];
  }
  const pens: Pen[] = idOrTag ? meta2d.find(idOrTag) || [] : meta2d.activePens || [];
  const names = new Set<string>();
  for (const pen of pens) {
    pen.animations?.forEach((a) => a.name && names.add(a.name));
  }
  return Array.from(names);
};

// 输入框得到的都是字符串，这里把 'true'/'false' 和数字字符串还原为对应类型
export const changeType = (value: string) => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  // 空串、非数字、以小数点结尾（正在输入小数）、超长数字串保持原样
  if (value === '' || isNaN(Number(value)) || value.endsWith('.') || value.length > 15) {
    return value;
  }
  return Number(value);
};
