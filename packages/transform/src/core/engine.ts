import {Inject, Options, TransformData} from "../types";

export function createTransformEngine(options:Options, inject:Inject){
  const context = createEngineContext(options,inject)

  const apply = (nodes: Node[])=>{

  }

  const transform = (transformData: TransformData )=>{

  }

  return {
    context: context,
    apply,
    transform
  }
}

function createEngineContext(options:Options, inject:Inject){

  return {
    origin: [],
    history:[],
    pens:[],
    lines:[]
  }
}
