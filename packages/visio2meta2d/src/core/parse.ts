import JSZip from "jszip";
import {Meta2dData} from "@meta2d/core";
import {TransferFunction} from "./transfers/types";
import {baseTransfer} from "@meta2d/visio2meta2d/src/core/transfers/base";

export class Factory {
  private file: File;
  private stags = ['transform', 'combinate'];
  private material: JSZip;
  private result: Meta2dData;
  private onerror: Function;
  private transfers:Map<string,TransferFunction[]> = new Map();
  constructor(file: File, onerror?: Function) {
    this.file = file;
    this.onerror = onerror || (()=>{});
    this.init();
    this.addTransfer('transform',baseTransfer);
  }
  private async load() {
    await this.unZipVsdx();
    let res = await this.transform();
  }
  private init(){
    this.stags.forEach(i=>{
      this.transfers.set(i,[]);
    });
  }
  private async transform(){
    let transfers = this.transfers.get('transform');
    let previousData = null;
    const transferData = [];

    for (const transfer of transfers) {
      previousData = await transfer(this.material.clone(),previousData);
      transferData.push(previousData);
    }

    return transferData;
  }
  public addTransfer(stage:string, transfer:TransferFunction) {
    if (this.transfers.has(stage)) {
      this.transfers.set(stage, [transfer]);
    }
  }

  /**
   * @description 加载解压vsdx文件 写入对象的material */
  private async unZipVsdx(): Promise<JSZip | false> {
    if (!(this.file instanceof Blob)) {
      console.error('file is not a valid type');
      this.onerror();
      return false;
    }

    if (!this.file.name.endsWith('.vsdx')) {
      console.error('file is not a valid type');
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


