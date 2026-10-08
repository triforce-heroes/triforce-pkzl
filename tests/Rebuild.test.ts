import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { rebuild } from "#/Rebuild";

const original = await readFile(new URL("fixtures/Text_000.pkz", import.meta.url));
const path = "Text/Prologue_USen.bin";
const payload = Buffer.from("PKZL replacement fixture");
const replacements = new Map([[path, payload]]);

describe(rebuild, () => {
  it("injects a raw buffer into the fixed Oodle entry", () => {
    const result = rebuild(original, replacements);

    // Prologue_USen is entry 189 in the unchanged Text fixture.
    expect(original.toString("utf-8", 0x30_b0, 0x30_c6)).toBe(path);
    expect(result.toString("hex", 0x17_c0, 0x17_e0)).toBe(
      "70120000100000001800000000000000405f1f00000000001800000000000000",
    );
    expect(result.toString("hex", 0x1f_5f_40, 0x1f_5f_58)).toBe(
      "504b5a4c207265706c6163656d656e742066697874757265",
    );
  });

  it("throws when the replacement path does not exist", () => {
    expect(() => rebuild(original, new Map([["Text/missing_USen.bin", payload]]))).toThrow(
      "PKZL: replacement path does not exist: Text/missing_USen.bin.",
    );
  });

  it("matches the expected rebuilt archive and preserves the original", () => {
    const result = rebuild(original, replacements);

    expect(result).toHaveLength(2_337_536);
    expect(result.toString("hex", 0, 32)).toBe(
      "706b7a6c0000020000ab230000000000f100000020000000a817000000100000",
    );
    expect(createHash("sha256").update(result).digest("hex")).toBe(
      "db1be7267b6001c67009adfa497d1dd8d2c3415b629d6fd95bc707ce33014d9a",
    );
    expect(createHash("sha256").update(original).digest("hex")).toBe(
      "27331a89c45f1708480624e572d3d73a29aea3cd50544d74273bd52e1d7c35e2",
    );
  });
});
