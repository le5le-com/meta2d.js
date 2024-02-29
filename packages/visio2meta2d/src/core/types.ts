/***
 * @description 类型定义
 */
import {GraphMap} from "@meta2d/visio2meta2d/src/core/map";

export type TransferFunction = (material: any, graphMap:GraphMap, previous:any) => Promise<MiddleProduct>;

export type CombinerFunction = (dataList:object[],previous:any) => any;

/**转换器与结合器的中间产物类型*/
export interface MiddleProduct {
  pens?:any[];
}
