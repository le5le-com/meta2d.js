import {Meta2d} from "@meta2d/core";

export {};

declare global {
  /**
   * 现在声明进入全局命名空间的类型，或者增加全局命名空间中的现有声明。
   */
  const meta2d: Meta2d;
  let toolbox:any;
  interface Window {
    [key:string]:any;
    [key:symbol]:any;
  }
}
