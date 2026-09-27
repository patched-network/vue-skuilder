import { describe, it, expect } from 'vitest';
import { unmetIntroExposeTags } from '../../../src/core/navigators/generators/prescribed';

describe('unmetIntroExposeTags', () => {
  it('implies gpc:expose:X from gpc:intro:X and requires minCount of it', () => {
    const tags = ['gpc:intro:v-V', 'concept:match:simple'];
    expect(unmetIntroExposeTags(tags, {}, 3)).toEqual(['gpc:expose:v-V']);
    expect(unmetIntroExposeTags(tags, { 'gpc:expose:v-V': { count: 2 } }, 3)).toEqual([
      'gpc:expose:v-V',
    ]);
    expect(unmetIntroExposeTags(tags, { 'gpc:expose:v-V': { count: 3 } }, 3)).toEqual([]);
  });

  it("counts the card's own gpc:expose:* tags once alongside the implied one", () => {
    const tags = ['gpc:intro:v-V', 'gpc:expose:v-V', 'gpc:expose:a-AE'];
    expect(unmetIntroExposeTags(tags, { 'gpc:expose:a-AE': { count: 5 } }, 3)).toEqual([
      'gpc:expose:v-V',
    ]);
  });

  it('minCount 0 requires nothing, even with no exposure entry at all', () => {
    const tags = ['gpc:intro:WORD-was', 'concept:match:whole_word'];
    expect(unmetIntroExposeTags(tags, {}, 0)).toEqual([]);
  });

  it('non-intro targets with no expose tags need nothing', () => {
    expect(unmetIntroExposeTags(['gpc:exercise:t-T'], {}, 3)).toEqual([]);
  });
});
