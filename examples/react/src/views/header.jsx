/*
 * @Description: 
 * @Author: 高浩然
 * @Date: 2021-10-11 16:37:42
 * @LastEditTime: 2021-10-13 15:01:39
 */
import React, { useCallback, useEffect, useRef } from 'react';

const Header = () => {
  const penBtn = useRef(null);
  const pencilBtn = useRef(null);
  const magnifierBtn = useRef(null);
  const minimapBtn = useRef(null);

  const onCreate = useCallback(() => {
    window.topology.open();
  }, []);

  const onOpen = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        window.topology.open(json);
      } catch {
        console.log('读取文件失败，请检查数据格式');
      }
    };
    reader.readAsText(file);
  }, []);

  const onSave = useCallback(() => {
    const filename = '测试数据.json';
    const data = window.topology.data();
    const json = JSON.stringify(data, undefined, 4);
    const blob = new Blob([ json ], { type: 'text/json' });
    const a = document.createElement('a');
    a.download = filename;
    a.href = window.URL.createObjectURL(blob);
    a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
    a.click();
  }, []);

  const onTogglePen = useCallback(() => {
    pencilBtn.current.className = '';
    window.topology.finishPencil();
    penBtn.current.className = 'active';
    window.topology.drawLine('curve');
  }, []);

  const onTogglePencil = useCallback(() => {
    if (penBtn.current.className === 'active') {
      return;
    }
    if (pencilBtn.current.className === 'active') {
      pencilBtn.current.className = '';
      window.topology.finishPencil();
    } else {
      pencilBtn.current.className = 'active';
      window.topology.drawingPencil();
    }
  }, []);

  const onToggleMagnifier = useCallback(() => {
    if (magnifierBtn.current.className === 'active') {
      magnifierBtn.current.className = '';
      window.topology.hideMagnifier();
    } else {
      magnifierBtn.current.className = 'active';
      window.topology.showMagnifier();
    }
  }, []);

  const onToggleMinimap = useCallback(() => {
    if (minimapBtn.current.className === 'active') {
      minimapBtn.current.className = '';
      window.topology.hideMap();
    } else {
      minimapBtn.current.className = 'active';
      window.topology.showMap();
    }
  }, []);

  const onHelp = useCallback(() => {
    window.open('https://www.yuque.com/alsmile/topology/cucep0');
  }, []);

  const onKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'b':
      case 'B':
        if (window.topology.canvas.pencil) {
          pencilBtn.current.className = 'active';
        } else {
          pencilBtn.current.className = '';
        }
        break;
      case 'v':
      case 'V':
        if (e.ctrlKey || e.metaKey) {
          return;
        } else {
          if (window.topology.canvas.drawingLineName) {
            penBtn.current.className = 'active';
          } else {
            penBtn.current.className = '';
          }
        }
        break;
      case 'm':
      case 'M':
        if (window.topology.canvas.magnifier) {
          minimapBtn.current.className = 'active';
        } else {
          minimapBtn.current.className = '';
        }
        break;
      case 'Escape':
        penBtn.current.className = '';
        pencilBtn.current.className = '';
        magnifierBtn.current.className = '';
        break;
      default:
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    }
  }, []);

  return (
    <div className="header" >
      <div className="logo" >
        <img src='/favicon.ico' alt="乐吾乐" />
      </div>
      <div className="button-group" >
        <button id="create" onClick = { onCreate } >新建文件</button>
        <button id="open" >
          打开文件
          <input id="open-input" type="file" onChange = { onOpen } />
        </button>
        <button id="save" onClick = { onSave } >保存</button>
        <button id="pen" onClick = { onTogglePen } ref = { penBtn } >钢笔</button>
        <button id="pencil" onClick = { onTogglePencil } ref = { pencilBtn } >铅笔</button>
        <button id="magnifier" onClick = { onToggleMagnifier } ref = { magnifierBtn } >放大镜</button>
        <button id="minimap" onClick = { onToggleMinimap } ref = { minimapBtn } >缩略图</button>
        <button id="help" onClick = { onHelp } >帮助</button>
      </div>
    </div>
  );
};

export default Header;