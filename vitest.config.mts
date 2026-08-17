import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Honour the `@/*` paths from tsconfig.json.
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Env is read lazily via getters, but tests still mutate process.env, so
    // keep files isolated from one another.
    isolate: true
  }
});
