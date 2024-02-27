import {TransferFunction} from "./types";
import JSZip from "jszip";
import {xmlFileToJson} from "@meta2d/visio2meta2d/src/utils/file";

/**
 * @description 首先进行最基本的转换，将page1.xml转为page1.xml.json
 * */

export const baseTransfer: TransferFunction =async (material:JSZip,previous) => {
  const json = await xmlFileToJson(material,'visio/pages/page1.xml');
  console.log(json);
};




