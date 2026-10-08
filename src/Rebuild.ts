import { BufferBuilder } from "@triforce-heroes/triforce-core/BufferBuilder";
import { BufferConsumer } from "@triforce-heroes/triforce-core/BufferConsumer";
import { nextMultiple } from "@triforce-heroes/triforce-core/Number";

const ENTRY_SIZE = 32;
const ALIGNMENT = 64;
// None is at 0x10 in the original Text_000.pkz string table.
const NONE_OFFSET = 0x10;

export type RawReplacements = ReadonlyMap<string, Buffer>;

export function rebuild(data: Buffer, replacements: RawReplacements): Buffer {
  const reader = new BufferConsumer(data, 16);
  const entryCount = reader.readUnsignedInt32();
  const indexOffset = reader.readUnsignedInt32();
  const stringTableSize = reader.readUnsignedInt32();
  const stringTableOffset = indexOffset + entryCount * ENTRY_SIZE;
  const stringsEnd = stringTableOffset + stringTableSize;
  const stringReader = new BufferConsumer(data);
  const pending = new Map(replacements);
  const payloads: Buffer[] = [];
  const file = new BufferBuilder();
  let payloadOffset = nextMultiple(stringsEnd, ALIGNMENT);

  file.push(data.subarray(0, 8));
  file.writeUnsignedInt64(() => BigInt(file.length));
  file.push(data.subarray(16, indexOffset));

  reader.seek(indexOffset);

  for (let index = 0; index < entryCount; index++) {
    const recordOffset = reader.byteOffset;
    const pathOffset = reader.readUnsignedInt32();

    reader.skip(12);
    const offset = Number(reader.readUnsignedInt64());
    const storedSize = Number(reader.readUnsignedInt64());

    stringReader.seek(stringTableOffset + pathOffset);
    const path = stringReader.readNullTerminatedString();
    const replacement = pending.get(path);
    const payload = replacement ?? data.subarray(offset, offset + storedSize);

    pending.delete(path);
    payloads.push(payload);

    if (replacement === undefined) {
      file.push(data.subarray(recordOffset, recordOffset + 16));
    } else {
      file.writeUnsignedInt32(pathOffset);
      file.writeUnsignedInt32(NONE_OFFSET);
      file.writeUnsignedInt64(BigInt(payload.length));
    }

    file.writeUnsignedInt64(BigInt(payloadOffset));
    file.writeUnsignedInt64(BigInt(payload.length));

    payloadOffset = nextMultiple(payloadOffset + payload.length, ALIGNMENT);
  }

  if (pending.size > 0) {
    throw new Error(`PKZL: replacement path does not exist: ${pending.keys().next().value}.`);
  }

  file.push(data.subarray(stringTableOffset, stringsEnd));
  file.pad(ALIGNMENT);

  for (const payload of payloads) {
    file.push(payload);
    file.pad(ALIGNMENT);
  }

  return file.build();
}
