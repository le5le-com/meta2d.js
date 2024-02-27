import { XMLParser } from 'fast-xml-parser/src/fxp';
import JSZip from "jszip";
export async function xmlFileToJson(materials:JSZip,path:string){
  let str = await materials.file(path).async("string");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    preserveOrder: true,
  });
  const xmlJson: any[] = parser.parse(str);
  return xmlJson;
}
