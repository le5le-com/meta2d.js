import {Pen} from "@meta2d/core";

export interface Meta2dContext {
  pen:Pen,
  parent:Pen,
  group:boolean,
  prevContext: Meta2dContext
}
