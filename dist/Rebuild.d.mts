//#region src/Rebuild.d.ts
export type RawFiles = ReadonlyMap<string, Buffer>;
export declare function rebuild(files: RawFiles): Buffer;
//#endregion