import { emitter } from "./emitter";
export const KeydownFns: { [key: string]: Function } = {
  Enter: preview,
  e: downloadJson,
  E: downloadJson,
  o: openFile,
  O: openFile,
  s: s,
  S: s,
  c: c,
  C: c,
  l: expandAll,
  L: expandAll,
  f: searchInputFocus,
  F: searchInputFocus,
  r: renamePen,
  R: renamePen,
};

function s(e: KeyboardEvent) {
  if(e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if(e.shiftKey) {
      emitter.emit('saveas');
      return;
    }
    emitter.emit('save');
  }

}

function preview(e: KeyboardEvent) {
  if((e.ctrlKey || e.metaKey) && e.altKey) {
    e.preventDefault();
    emitter.emit('preview');
  }
}

function openFile(e: KeyboardEvent) {
  if(e.ctrlKey || e.metaKey) {
    e.preventDefault();
    emitter.emit('openFile');
  }
}

function downloadJson(e: KeyboardEvent) {
  if((e.ctrlKey || e.metaKey) && e.shiftKey) {
    e.preventDefault();
    emitter.emit('downloadJson');
  }
}

function c(e: KeyboardEvent) {
  if((e.ctrlKey || e.metaKey) && e.shiftKey) {
    e.preventDefault();
    emitter.emit('formatBrush');
  }
}

function expandAll(e: KeyboardEvent) {
  if(e.altKey) {
    e.preventDefault();
    emitter.emit('expandAll');
  }
}

function searchInputFocus(e: KeyboardEvent) {
  if(e.ctrlKey || e.metaKey) {
    e.preventDefault();
    emitter.emit('searchInputFocus');
  }
}

function renamePen(e: KeyboardEvent) {
  if(e.ctrlKey || e.metaKey) {
    e.preventDefault();
    emitter.emit('renamePen');
  }
}