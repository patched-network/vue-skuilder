// interface VowelWordData {
//   vowel: string; // length 1
//   consonents: VowelConsonentWordData[];
// }
// interface VowelConsonentWordData {
//   consonent: string; // length 1
//   e_examples: string; // of individual letters
//   double_examples: string; //  ^^^       ^^^
//   exceptions: string;
//   blends: string[];
// }

export default {
  a: {
    c: ['_rlp', '', [['br', 'pl', 'sp', 'tr']]],
    d: ['w', 'fm'],
    k: ['bfJlmrstw'],
    l: ['_mst'],
    m: ['fglnst'],
    n: ['ls', 'bm'],
    f: ['s'],
    g: ['mp', 'rsw'],
    p: ['_', 't'],
    r: ['dh', 'bcdf', '_'],
    s: ['bc'],
    t: ['dgl', '_fhmr', '', [['sk', 'st', 'pl', 'cr']]],
    v: ['cDgprsw', '', 'h'],
  },
  e: {
    k: ['_d'],
    n: ['g'],
    r: ['', 'h', 'w'],
    t: ['P'],
  },
  i: {
    b: ['', '', '', [['br', 'tr']]],
    c: ['_dlnr'],
    d: ['bstw', 'hr', '', [['br']]],
    f: ['lrw', '', '', [['kn', 'str']]],
    k: ['bhlp'],
    l: ['bfmptv', '', '', [['wh']]],
    m: ['l', 'dT', '', [['cr']]],
    n: ['dflmnpv'],
    p: ['pw', 'r', '', [[], ['gr', 'tr', 'str']]],
    r: ['_dfhtw'],
    s: ['rw'],
    t: ['', 'bks'],
  },
  o: {
    b: ['', 'r', '', [['gl', 'str']]],
    d: ['_bm', 'rn'],
    l: ['dhmprt', '', '', []],
    m: ['dh'],
    n: ['bhlt', '_dn'],
    p: ['dnr', 'chm'],
    r: ['_bcglmstw'],
    s: ['', '', 'l', [['cl']]],
    t: ['mv', 'n'],
    v: ['cw', '', 'dlm', [['st']]],
    z: ['d'],
  },
  u: {
    b: ['', 'crt'],
    d: ['r', 'd'],
    g: ['', 'hl'],
    k: ['dLp', '', '', [['fl']]],
    l: ['mr'],
    n: ['dt', 'r'],
    r: ['', '', 'cps'],
    s: ['fr', '_'],
    t: ['m', 'c'],
  },
};
