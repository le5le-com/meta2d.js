// IR 数据格式与构建工具在 @meta2d/drawir（与 DrawIR 的 @drawir/core 同一份，平台无关）；这里重新导出，保持 core 原有的导出面不变
export * from '@meta2d/drawir';
// 以下是 meta2d 渲染后端：IR 的 '$fg' / '$bg' / '$lw' 在这里绑定到图元的 color / background / lineWidth
export * from './pen-rect';
export * from './store';
export * from './editable';
export * from './convert';
export * from './renderer';
