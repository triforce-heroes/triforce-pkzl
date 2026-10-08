//#region src/Rebuild.d.ts
export type RawReplacements = ReadonlyMap<string, Buffer>;
export declare function rebuild(data: Buffer, replacements: RawReplacements): Buffer;
//#endregion