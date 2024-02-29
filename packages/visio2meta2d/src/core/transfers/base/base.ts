import {TransferFunction} from "../../types";
import JSZip from "jszip";
import {lowercaseFirstCharacter, xmlFileToJson} from "../../../utils";
import {GraphMap} from "@meta2d/visio2meta2d/src/core/map";

/**
 * @description 首先进行最基本的转换，将page1.xml转为page1.xml.json
 * */

export const baseTransfer: TransferFunction = async (material:JSZip, graph:GraphMap, previous) => {
  const xmlJson = await xmlFileToJson(material,'visio/pages/page1.xml');
  const json = {
    pens:[]
  };
  let pens = [];
  if (xmlJson[1].PageContents) {
    //所有图元
    xmlJson[1].PageContents[0].Shapes.forEach((item) => {
      let pen = {};
      //图元 id name type
      Object.keys(item[':@']).forEach(function (key: string) {
        let v = parseFloat(item[':@'][key]);
        if (Number.isNaN(v)) {
          pen[lowercaseFirstCharacter(key)] = lowercaseFirstCharacter(
            item[':@'][key]
          );
        } else {
          pen[lowercaseFirstCharacter(key)] = v;
        }
      });

      //图元属性 x y lineWeight
      item.Shape.forEach((shape) => {
        let v = parseFloat(shape[':@']['V']);
        if (Number.isNaN(v)) {
          pen[lowercaseFirstCharacter(shape[':@']['N'])] =
            lowercaseFirstCharacter(shape[':@']['V']);
        } else {
          pen[lowercaseFirstCharacter(shape[':@']['N'])] = v;
        }
      });
      pens.push(pen);
    });

    //连接关系
    let connects = [];
    // xmlJson[1].PageContents[1].Connects.forEach((item) => {
    //   Object.keys(item[':@']).forEach(function (key: string) {
    //     let connect = {};
    //     let v = parseFloat(item[':@'][key]);
    //     if (Number.isNaN(v)) {
    //       connect[lowercaseFirstCharacter(key)] =
    //         lowercaseFirstCharacter(item[':@'][key]);
    //     } else {
    //       connect[lowercaseFirstCharacter(key)] = v;
    //     }
    //     connects.push(connect);
    //   });
    // });
  }
  if (xmlJson[1].Masters) {
    //所有

    xmlJson[1].Masters.forEach((item) => {
      let master = {};
      Object.keys(item[':@']).forEach(function (key: string) {
        let v = parseFloat(item[':@'][key]);
        if (Number.isNaN(v)) {
          master[lowercaseFirstCharacter(key)] =
            lowercaseFirstCharacter(item[':@'][key]);
        } else {
          master[lowercaseFirstCharacter(key)] = v;
        }
      });
      item['Master'].forEach((_master) => {
        _master[0]?.PageSheet.forEach((_item) => {
          let v = parseFloat(_item[':@']['V']);
          if (Number.isNaN(v)) {
            master[lowercaseFirstCharacter(_item[':@']['N'])] =
              lowercaseFirstCharacter(_item[':@']['V']);
          } else {
            master[lowercaseFirstCharacter(_item[':@']['N'])] = v;
          }
        });

        //_master[1]

        //_master[2]
      });

      pens.push(master);
    });
  }
  if(pens.length){
    if(!json.pens.length){
      json.pens = pens;
    }else{
      json.pens.forEach((item)=>{
        pens.forEach((pen)=>{
          if(item.iD === pen.iD){
            // item = pen;
            Object.assign(item,pen);
          }
        });
      });
    }
  }
  console.log(json,'json');
  return json;
};





