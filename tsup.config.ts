import { defineConfig } from 'tsup';

/**
 * ESM + CJS library build. AgentKit's `@CreateAction` reads the decorated
 * method's parameter types at runtime, so the build must emit decorator
 * metadata: with `emitDecoratorMetadata` in tsconfig.json, tsup compiles the
 * sources with @swc/core (legacy decorators + metadata) instead of esbuild's
 * transform. Dependencies and the AgentKit peer stay external.
 */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  target: 'es2022',
  platform: 'node',
  dts: true,
  sourcemap: false,
  clean: true,
  splitting: false,
  treeshake: false,
});
