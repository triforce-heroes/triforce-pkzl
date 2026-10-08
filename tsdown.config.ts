import { defineConfig } from "tsdown";

const config = defineConfig({
  entry: ["./src/Rebuild.ts"],
  minify: true,
  platform: "node",
});

export default config;
