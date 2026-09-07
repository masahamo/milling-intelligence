declare module '@appdeploy/client' {export const api:{get(url:string):Promise<{data:any}>;post(url:string,data?:unknown):Promise<{data:any}>};}
declare module '@appdeploy/sdk' {
  export const db:{list<T=Record<string,any>>(table:string,options?:{limit?:number;nextToken?:string}):Promise<{items:Array<T&{id:string}>;nextToken?:string}>;add(table:string,records:Record<string,unknown>[]):Promise<(string|null)[]>;update(table:string,records:{id:string;record:Record<string,unknown>}[]):Promise<boolean[]>};
  export const ai:any;
  export function router(routes:Record<string,((context:{query:Record<string,string>})=>Promise<any>)[]>):any;
  export function json(value:unknown):any;
  export function error(message:string,status:number):any;
}

