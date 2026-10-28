<template>
  <div ref="dom" class="code-editor"></div>
</template>
<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';

//按需引入
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/editor/browser/widget/codeEditorWidget.js';
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/esm/vs/editor/contrib/caretOperations/browser/caretOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/caretOperations/browser/transpose.js';
import 'monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/esm/vs/editor/contrib/codeAction/browser/codeActionContributions.js';
import 'monaco-editor/esm/vs/editor/contrib/copyPaste/browser/copyPasteContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/comment/browser/comment.js';
import 'monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-editor/esm/vs/editor/contrib/cursorUndo/browser/cursorUndo.js';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/esm/vs/editor/contrib/format/browser/formatActions.js';
import 'monaco-editor/esm/vs/editor/contrib/documentSymbols/browser/documentSymbols.js';
import 'monaco-editor/esm/vs/editor/contrib/inlineCompletions/browser/inlineCompletions.contribution.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hover.js';
import 'monaco-editor/esm/vs/editor/contrib/indentation/browser/indentation.js';
import 'monaco-editor/esm/vs/editor/contrib/inlayHints/browser/inlayHintsContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/inPlaceReplace/browser/inPlaceReplace.js';
import 'monaco-editor/esm/vs/editor/contrib/lineSelection/browser/lineSelection.js';
import 'monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/linkedEditing/browser/linkedEditing.js';
import 'monaco-editor/esm/vs/editor/contrib/links/browser/links.js';
import 'monaco-editor/esm/vs/editor/contrib/longLinesHelper/browser/longLinesHelper.js';
import 'monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/esm/vs/editor/contrib/parameterHints/browser/parameterHints.js';
import 'monaco-editor/esm/vs/editor/contrib/rename/browser/rename.js';
import 'monaco-editor/esm/vs/editor/contrib/semanticTokens/browser/documentSemanticTokens.js';
import 'monaco-editor/esm/vs/editor/contrib/semanticTokens/browser/viewportSemanticTokens.js';
import 'monaco-editor/esm/vs/editor/contrib/smartSelect/browser/smartSelect.js';
import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js';
import 'monaco-editor/esm/vs/editor/contrib/stickyScroll/browser/stickyScrollContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestInlineCompletions.js';
import 'monaco-editor/esm/vs/editor/contrib/tokenization/browser/tokenization.js';
import 'monaco-editor/esm/vs/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js';
import 'monaco-editor/esm/vs/editor/contrib/unicodeHighlighter/browser/unicodeHighlighter.js';
import 'monaco-editor/esm/vs/editor/contrib/unusualLineTerminators/browser/unusualLineTerminators.js';
import 'monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js';
import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/wordPartOperations/browser/wordPartOperations.js';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution'

import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';
import {MonacoTypeManager} from "../services/utils.ts";

const dom = ref<any>();

const { modelValue, json, language, options, hints } = defineProps<{
  modelValue: any;
  json?: boolean;
  language?: string;
  hints?: any; 
  options?: any;
}>();

const emit = defineEmits(['update:modelValue', 'change']);
let editor: monaco.editor.IStandaloneCodeEditor;

const typeManager = new MonacoTypeManager(monaco);
typeManager.clearTypeFiles()

onMounted(() => {
  let text = '';
  if (json) {
    if (modelValue) {
      text = JSON.stringify(modelValue);
    }
  } else {
    text = modelValue;
  }
  editor = monaco.editor.create(dom.value, {
    value: text,
    automaticLayout: true,
    minimap: { enabled: false },
    language: language || 'javascript',
    lineNumbersMinChars:1,
    lineDecorationsWidth:0,
    ...options,
  });
  editor.onDidChangeModelContent(() => {
    const currenValue = editor.getValue();
    if (json) {
      let obj: any;
      try {
        obj = JSON.parse(currenValue);
      } catch {}
      emit('update:modelValue', obj);
      emit('change', obj);
    } else {
      emit('update:modelValue', currenValue);
      emit('change', currenValue);
    }
  });

  setTimeout(() => {
    editor.getAction('editor.action.formatDocument')!.run();
  }, 300);
});

let completionDisposables: monaco.IDisposable[] = [];
watch(() => hints, (newValue) => {
  if (!hints) return;

  completionDisposables.forEach(disposable => disposable.dispose());

  newValue.forEach((hint: any) => {
    if (hint.type && !hint.typeFilePath) {
      typeManager.injectVariableType(hint.obj,hint.type)
    }else if(hint.type && hint.typeFilePath){
      typeManager.loadTypeFile(hint.typeFilePath,()=>{
        typeManager.injectVariableType(hint.obj,hint.type)
      })

    }

    const instance = monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: [hint.trigger],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        const match = textUntilPosition.match(new RegExp(`(\\b(${hint.obj})\\${hint.trigger})$`));
        if (!match) return { suggestions: [] };

        const properties = hint.properties;
        if (properties) {
          return {
            suggestions: properties.map(prop => ({
              label: String(prop.label),
              kind: prop.kind,
              insertText: prop.insertText,
              detail: prop.detail,
            })),
          dispose() {
            if(!hint.replace)return
             const line = position.lineNumber
             const column = position.column
             editor.executeEdits("", [
               {
                 range: new monaco.Range(line, column - hint.obj.length - 1, line, column),
                 text: null
               }
             ])
          }
          };
        }
      }
    });

    completionDisposables.push(instance);
  });
}, { immediate: true });
watch(
  () => options,
  (newValue) => {
    editor.updateOptions(newValue);
  },
  { deep: true }
);

watch(
  () => language,
  (newValue) => {
    monaco.editor.setModelLanguage(editor.getModel()!, newValue as string);

  }
);

onUnmounted(() => {
  completionDisposables.forEach(disposable=>{disposable.dispose()})
  editor?.dispose();
});
</script>
<style lang="postcss" scoped>
.code-editor {
  border: 1px solid var(--color-sub-border);
  width: 100%;
  min-height: 160px;

  :deep(.monaco-editor) {
    --vscode-editorGutter-background: var(--color-background-editor);
    --vscode-editor-background: var(--color-background-editor);

    .view-overlays .current-line {
      border: 1px solid var(--color-border-editor);
    }
  }
}
</style>
