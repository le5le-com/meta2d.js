import {MiddleProduct} from "../../types";
import {GraphMap} from "@meta2d/visio2meta2d/src/core/map";

export function baseCombiner(middleProducts:MiddleProduct[], previous) {

  if(middleProducts.length === 0)return;

  middleProducts.forEach(middleProduct =>{

    middleProduct.pens.forEach(pen=>{
      console.log(pen,'pen');
    });
  });

}


