import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PageParamsPassingService {

  protected lookupTable : any = {};

  constructor() 
  { 
  }

  public addOrReplace(url : string, obj :any) : void
  {
    this.lookupTable[url] = obj;
  }

  public find(url : string) : any
  {
    return this.lookupTable[url];
  }
}
