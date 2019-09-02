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

  public remove(url : string) 
  {
    var data = this.lookupTable[url];

    if( data )
    {
      delete this.lookupTable[url];
    }
  }

  public findAndRemove(url : string) : any
  {
    var data = this.lookupTable[url];

    if( !data )
    {
      return null;
    }
    
    // Find and remove
    delete this.lookupTable[url];
    return data;
  }
}
