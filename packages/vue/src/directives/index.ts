import {patchVShow} from "./show";
import {Meta2d} from "@meta2d/core";

export function pathDirectives(meta2d:Meta2d, dirs:any){
  if(!dirs || dirs.length == 0)return

  dirs.forEach(dir => {
    const name = dir.dir.name
    if (name === 'show'){
      patchVShow(meta2d,dir)
    }
  })
}
