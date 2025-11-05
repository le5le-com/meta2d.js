import {Meta2d} from "@meta2d/core";

let target = null
export function useMeta2d(dom?,config?):{meat2d:Meta2d} {
    if(target)return {
        meat2d:target
    }
    target = new Meta2d(dom, config)
    return {
        meat2d: target
    }
}