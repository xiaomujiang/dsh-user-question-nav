/**
 * tsdown build for dsh-user-question-nav: a minimal host half (ESM node)
 * plus two browser client bundles (CJS closure factory) — one per install
 * channel, matching the dsh-better-sidebar pattern.
 *
 * - `lib/client.js` serves the official profile channel (bundle id = package name)
 * - `lib/client-registry.js` serves the plugin-registry channel (bundle id = manifest id)
 *
 * The client bundle is a pure DOM plugin with zero framework dependencies.
 */
import type { UserConfig } from 'tsdown'

const PLUGIN_NAME = 'dsh-user-question-nav'
const PLUGIN_ID = 'dsh-external/dsh-user-question-nav'

/** One client bundle: CJS closure wrapped in __ModuleLoader__.load(). */
function clientBundle(pluginId: string, entryFile: string): UserConfig {
  return {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [],
    outputOptions: {
      entryFileNames: entryFile,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pluginId)}, factory: (require) => {`,
      footer: `return module.exports; } });`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      codeSplitting: false,
    },
  }
}

export default [
  // Host half (ESM for Node.js)
  {
    entry: { index: 'src/index.ts', invariant: 'src/invariant.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    // emit .js (not .mjs): package.json `main` and dsh.plugin.json both point
    // at lib/index.js; tsdown 0.22+ defaults fixedExtension to true.
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  // Official profile channel: bundle id = package name
  clientBundle(PLUGIN_NAME, 'client.js'),
  // Plugin-registry channel: bundle id = manifest id
  clientBundle(PLUGIN_ID, 'client-registry.js'),
] satisfies UserConfig[]