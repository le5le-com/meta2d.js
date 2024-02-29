import JSZip from "jszip";
import {deepClone, Meta2dData} from "@meta2d/core";
import {CombinerFunction, MiddleProduct, TransferFunction} from "./types";
import {baseTransfer} from "../transfers";
import {baseCombiner} from "../combiners";
import {GraphMap} from "./map";

export class V2M {
  private file: File;
  private stags = ['transform', 'combinate'];
  private material: JSZip;
  private result: Meta2dData;
  private readonly onerror: Function;
  private transfersMap: Map<string, (TransferFunction | CombinerFunction)[]> = new Map();
  public graphMap = new GraphMap();

  constructor(file: File, onerror?: Function) {
    this.file = file;
    this.onerror = onerror || (() => {
    });
    this.init();

    this.addTransfer('transform', baseTransfer);
    this.addTransfer('combinate', baseCombiner);
  }

  private async load() {
    await this.unZipVsdx();
    let transformDataList = await this.transform();
    let product = await this.combinate(transformDataList);
    this.clear();
    return product;
  }

  private init() {
    this.stags.forEach(i => {
      this.transfersMap.set(i, []);
    });
  }

  private async transform(): Promise<MiddleProduct[]> {
    let transfers = this.transfersMap.get('transform');
    let previousData = null;
    const transferData = [];

    for (const transfer of transfers) {
      // @ts-ignore
      previousData = await transfer(this.material.clone(), this.graphMap, previousData);
      transferData.push(previousData);
    }
    return transferData;
  }

  private async combinate(transformDataList: MiddleProduct[]) {
    const combiners = this.transfersMap.get('combinate');
    let product = null;
    for (const combiner of combiners) {
      // @ts-ignore
      product = combiner(deepClone(transformDataList), product);
    }
    return product;
  }

  public addTransfer(stage: string, transfer: TransferFunction | CombinerFunction) {
    if (this.transfersMap.has(stage)) {
      this.transfersMap.get(stage).push(transfer);
    }
  }

  /**
   * @description 加载解压vsdx文件 写入对象的material */
  private async unZipVsdx(): Promise<JSZip | false> {
    if (!(this.file instanceof Blob) || !this.file.name.endsWith('.vsdx')) {
      console.error('file is not a valid type');
      this.onerror();
      return false;
    }

    // 解压文件
    let zip = await JSZip.loadAsync(this.file).catch((e) => {
      this.onerror();
      return e;
    });
    if (Object.keys(zip.files).length == 0) {
      if (onerror != null) {
        this.onerror();
      }
      return false;
    }
    this.material = zip;
  }

  public outPut() {
    return this.result;
  }

  public clear() {
    this.file = null;
    this.material = null;
    this.result = null;
  }
}


