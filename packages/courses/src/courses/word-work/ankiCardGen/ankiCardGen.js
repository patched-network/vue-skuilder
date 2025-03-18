// usage: node ankiCardGen.js

var data = {
  a: {
    c: ['_rlp', '', '', [['br', 'pl', 'sp', 'tr']]],
    d: ['w', 'fm'],
    k: ['bfJlmrstw', '', '', [['br', 'fl', 'mist']]],
    l: ['_mst'],
    m: ['fglnst', '', '', [['fl', 'fr']]],
    n: ['ls', 'bm', '', [['pl', 'cr']]],
    f: ['s'],
    g: ['mp', 'rsw'],
    p: ['_', 't', '', [['gr']]],
    r: ['dh', 'bcf', '_'],
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
    t: ['v', 'n'],
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

generateCards(data, 'a');

function generateCards(vowelData) {
  // { a: { b:{} c:{} ... } o: { b:{} c:{} ... } }
  Object.keys(vowelData).forEach(function (vowel) {
    // for each vowel...
    // console.log(vowel);
    generateCardsForTrailingConsonant(vowelData[vowel], vowel);
  });
}

function generateCardsForTrailingConsonant(trailingConsonantData, vowel) {
  // {
  Object.keys(trailingConsonantData).forEach(function (trailingConsonant) {
    // console.log('\t' + trailingConsonant);
    //console.log('\t\t' + trailingConsonantData[trailingConsonant]);
    splitLeadingConsonantData(trailingConsonantData[trailingConsonant], vowel, trailingConsonant);
  });
}

function splitLeadingConsonantData(leadingData, vowel, trailingConsonant) {
  if (leadingData[0]) {
    generateConsonantWords(leadingData[0], vowel, trailingConsonant);
  }

  if (leadingData[1]) {
    generateConsonantWords(leadingData[1], vowel, trailingConsonant, true);
  }

  if (leadingData[2]) {
    generateExceptions(leadingData[2], vowel, trailingConsonant);
  }

  if (leadingData[3]) {
    if (leadingData[3][0]) {
      generateConsonantWords(leadingData[3][0], vowel, trailingConsonant, false);
    }
    if (leadingData[3][1]) {
      generateConsonantWords(leadingData[3][1], vowel, trailingConsonant, true);
    }
  }
}

function generateExceptions(leadingConsonants, vowel, trailingConsonant) {
  generateConsonantWords(leadingConsonants, vowel, trailingConsonant);
}

function generateConsonantWords(leadingConsonants, vowel, finalConsonant, double) {
  for (var i = 0; i < leadingConsonants.length; i++) {
    console.log(consonantWord(leadingConsonants[i], vowel, finalConsonant, double));
  }
}

function consonantWord(openingConsonant, vowel, finalConsonant, double) {
  var ret = '';

  if (openingConsonant === '_') {
    openingConsonant = '';
  }

  ret += openingConsonant + vowel + finalConsonant + 'e';
  if (double) {
    ret += ',' + openingConsonant + vowel + finalConsonant;
  }
  return ret;
}

function blendedConsonantWord(blend, vowel, finalConsonant, double) {
  var ret = '';

  ret += blend + vowel + finalConsonant + 'e\n';
  if (double) {
    ret += blend + vowel + finalConsonant + '\n';
  }
  return ret;
}

function init() {
  var div = document.getElementById('words');
  var words = div.innerText.split(',');

  div.innerHTML = '';
  shuffle(words);
  words = words.slice(0, 4); // display a max of 5 words on each card
  div.innerHTML = words.join('<br><br>');

  function shuffle(array) {
    var currentIndex = array.length,
      temporaryValue,
      randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }
}
