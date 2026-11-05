// Entry points shared by the ESM build (rolldown.config.mjs) and the CommonJS
// + types build (tsup.config.ts). One per package.json export, plus
// impl/couch.
export const entries = [
  'src/index.ts',
  'src/core/index.ts',
  'src/pouch/index.ts',
  'src/impl/couch/index.ts',
  'src/impl/static/index.ts',
  'src/util/packer/index.ts',
  'src/diagnostics/index.ts',
];
