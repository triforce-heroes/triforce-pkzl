import { BufferBuilder } from "@triforce-heroes/triforce-core/BufferBuilder";
import { nextMultiple } from "@triforce-heroes/triforce-core/Number";

const HEADER_SIZE = 32;
const ENTRY_SIZE = 32;
const VERSION = 0x00_02_00_00;
const HEADER_FLAGS = 0x10_00;
const ALIGNMENT = 64;
const STRING_ALIGNMENT = 8;

interface FileEntry {
  pathOffset: number;
  payload: Buffer;
}

export type RawFiles = ReadonlyMap<string, Buffer>;

export function rebuild(files: RawFiles): Buffer {
  const entries: FileEntry[] = [];
  const strings = new BufferBuilder();

  strings.writeNullTerminatedString("None");
  strings.pad(STRING_ALIGNMENT);

  for (const [path, payload] of files) {
    entries.push({ pathOffset: strings.length, payload });
    strings.writeNullTerminatedString(path);
    strings.pad(STRING_ALIGNMENT);
  }

  const file = new BufferBuilder();
  let payloadOffset = nextMultiple(
    HEADER_SIZE + entries.length * ENTRY_SIZE + strings.length,
    ALIGNMENT,
  );

  file.writeString("pkzl");
  file.writeUnsignedInt32(VERSION);
  file.writeUnsignedInt64(() => BigInt(file.length));
  file.writeUnsignedInt32(entries.length);
  file.writeUnsignedInt32(HEADER_SIZE);
  file.writeUnsignedInt32(strings.length);
  file.writeUnsignedInt32(HEADER_FLAGS);

  for (const entry of entries) {
    file.writeUnsignedInt32(entry.pathOffset);
    file.writeUnsignedInt32(0);
    file.writeUnsignedInt64(BigInt(entry.payload.length));
    file.writeUnsignedInt64(BigInt(payloadOffset));
    file.writeUnsignedInt64(BigInt(entry.payload.length));

    payloadOffset = nextMultiple(payloadOffset + entry.payload.length, ALIGNMENT);
  }

  file.push(strings.build());
  file.pad(ALIGNMENT);

  for (const entry of entries) {
    file.push(entry.payload);
    file.pad(ALIGNMENT);
  }

  return file.build();
}
