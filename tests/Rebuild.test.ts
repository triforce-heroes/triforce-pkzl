import { describe, expect, it } from "vitest";

import { rebuild } from "#/Rebuild";

const path = "Text/Prologue_USen.bin";
const payload = Buffer.from("PKZL file buffer fixture");
const files = new Map([[path, payload]]);

interface PatchEntry {
  path: string;
  compression: string;
  size: number;
  offset: number;
  storedSize: number;
  payload: Buffer;
}

function readEntries(data: Buffer): PatchEntry[] {
  const count = data.readUInt32LE(16);
  const indexOffset = data.readUInt32LE(20);
  const stringTableOffset = indexOffset + count * 32;
  const entries: PatchEntry[] = [];

  for (let index = 0; index < count; index++) {
    const recordOffset = indexOffset + index * 32;
    const pathOffset = stringTableOffset + data.readUInt32LE(recordOffset);
    const compressionOffset = stringTableOffset + data.readUInt32LE(recordOffset + 4);
    const size = Number(data.readBigUInt64LE(recordOffset + 8));
    const offset = Number(data.readBigUInt64LE(recordOffset + 16));
    const storedSize = Number(data.readBigUInt64LE(recordOffset + 24));

    entries.push({
      path: data.toString("utf-8", pathOffset, data.indexOf(0, pathOffset)),
      compression: data.toString("utf-8", compressionOffset, data.indexOf(0, compressionOffset)),
      size,
      offset,
      storedSize,
      payload: data.subarray(offset, offset + storedSize),
    });
  }

  return entries;
}

describe(rebuild, () => {
  it("creates a compact patch containing only the supplied raw file", () => {
    const result = rebuild(files);

    expect(result).toHaveLength(192);
    expect(result.toString("utf-8", 0, 4)).toBe("pkzl");
    expect(result.readUInt32LE(4)).toBe(0x00_02_00_00);
    expect(result.readBigUInt64LE(8)).toBe(BigInt(result.length));
    expect(result.readUInt32LE(20)).toBe(32);
    expect(result.readUInt32LE(24)).toBe(32);
    expect(result.readUInt32LE(28)).toBe(0x10_00);
    expect(readEntries(result)).toStrictEqual([
      {
        path,
        compression: "None",
        size: payload.length,
        offset: 128,
        storedSize: payload.length,
        payload,
      },
    ]);
    expect(result.indexOf("OodleKraken")).toBe(-1);
    expect(result.indexOf("Text/archive_CSzk.bin")).toBe(-1);
  });

  it("creates entries for supplied paths without consulting an original archive", () => {
    const newPath = "Text/new_USen.bin";
    const result = rebuild(new Map([[newPath, payload]]));
    const entries = readEntries(result);

    expect(entries).toHaveLength(1);
    expect(entries.at(0)?.path).toBe(newPath);
    expect(entries.at(0)?.payload).toStrictEqual(payload);
  });

  interface PayloadCase {
    label: string;
    size: number;
  }

  const payloadCases: PayloadCase[] = [
    { label: "empty", size: 0 },
    { label: "aligned", size: 64 },
    { label: "unaligned", size: 65 },
  ];

  it.each(payloadCases)("aligns multiple raw files with an $label payload", ({ size }) => {
    const firstPath = "Text/archive_CSzk.bin";
    const firstPayload = Buffer.alloc(size, 0x61);
    const result = rebuild(
      new Map([
        [path, payload],
        [firstPath, firstPayload],
      ]),
    );
    const entries = readEntries(result);

    expect(entries.map((entry) => entry.path)).toStrictEqual([path, firstPath]);
    expect(entries.map((entry) => entry.payload)).toStrictEqual([payload, firstPayload]);
    expect(entries.map((entry) => entry.compression)).toStrictEqual(["None", "None"]);
    expect(entries.map((entry) => entry.size)).toStrictEqual([payload.length, size]);
    expect(entries.map((entry) => entry.storedSize)).toStrictEqual([payload.length, size]);

    for (const entry of entries) {
      expect(entry.offset % 64).toBe(0);
      expect(entry.offset).toBeLessThanOrEqual(result.length);
    }

    expect(result.length % 64).toBe(0);
    expect(result.readBigUInt64LE(8)).toBe(BigInt(result.length));
  });

  it("creates an empty patch when there are no files", () => {
    const result = rebuild(new Map());

    expect(result).toHaveLength(64);
    expect(result.readBigUInt64LE(8)).toBe(64n);
    expect(readEntries(result)).toStrictEqual([]);
  });

  it("preserves the file map and buffers", () => {
    rebuild(files);

    expect(payload.toString()).toBe("PKZL file buffer fixture");
    expect(files.size).toBe(1);
    expect(files.get(path)).toBe(payload);
  });
});
