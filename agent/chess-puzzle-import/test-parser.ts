/**
 * Test CSV Parser with Lichess sample data
 */

import { parsePuzzleCSV, ParsedPuzzle } from './csvPuzzleParser';

// Test data from user's Lichess sample
const testCases = [
  {
    name: 'Sample 1 - with trailing comma',
    csv: 'aIBfE,3r1k2/pR2N1bp/6p1/7n/8/8/PPPB1PPP/6K1 w - - 3 23,d2b4 d8d1 b4e1 d1e1,600,108,94,488,backRankMate endgame mate mateIn2 short,https://lichess.org/DJMQsaKA#45,',
    expected: {
      puzzleId: 'aIBfE',
      elo: 600,
      themes: ['backRankMate', 'endgame', 'mate', 'mateIn2', 'short'],
      openings: [],
    },
  },
  {
    name: 'Sample 2 - no trailing comma',
    csv: 'AIbIx,1k3b2/ppp1q3/3p1N1p/3P1PpP/2P1Q1P1/1P6/P7/1K6 b - - 2 43,e7f6 e4e8 f6d8 e8d8,600,101,87,652,endgame mate mateIn2 queensideAttack short,https://lichess.org/sZ0JJZm0/black#86',
    expected: {
      puzzleId: 'AIbIx',
      elo: 600,
      themes: ['endgame', 'mate', 'mateIn2', 'queensideAttack', 'short'],
      openings: [],
    },
  },
  {
    name: 'Sample 3 - with whitespace',
    csv: '  aiE0V,2kr1r2/ppp1n2p/4q1p1/6Q1/8/8/PP3PPP/3RR1K1 w - - 0 22,e1e6 d8d1 e6e1 d1e1,600,91,73,182,endgame hangingPiece mate mateIn2 short,https://lichess.org/uXQWCdhL#43,  ',
    expected: {
      puzzleId: 'aiE0V',
      elo: 600,
      themes: ['endgame', 'hangingPiece', 'mate', 'mateIn2', 'short'],
      openings: [],
    },
  },
  {
    name: 'Sample 4 - with empty openings',
    csv: 'aiHV3,3r2k1/pp3ppp/5p2/5q2/3Q4/5PP1/PP5P/R3R1K1 b - - 0 21,d8d4 e1e8,600,105,85,230,backRankMate endgame mate mateIn1 oneMove queenRookEndgame,https://lichess.org/Eal2rOeN/black#42,',
    expected: {
      puzzleId: 'aiHV3',
      elo: 600,
      themes: ['backRankMate', 'endgame', 'mate', 'mateIn1', 'oneMove', 'queenRookEndgame'],
      openings: [],
    },
  },
  {
    name: 'Hypothetical - with openings',
    csv: 'test1,rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1,e2e4 e7e5,1500,80,90,100,opening fork,https://lichess.org/test#1,Italian_Game Italian_Game_Classical',
    expected: {
      puzzleId: 'test1',
      elo: 1500,
      themes: ['opening', 'fork'],
      openings: ['opening:Italian_Game', 'opening:Italian_Game_Classical'],
    },
  },
  {
    name: 'Invalid - too few fields',
    csv: 'bad1,fen,moves,600',
    expected: null,
  },
  {
    name: 'Invalid - missing required field',
    csv: ',fen,moves,600,80,90,100,themes,url,openings',
    expected: null,
  },
  {
    name: 'Invalid - empty line',
    csv: '',
    expected: null,
  },
];

console.log('=== CSV Parser Test ===\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`Test: ${testCase.name}`);

  const result = parsePuzzleCSV(testCase.csv, true);

  if (testCase.expected === null) {
    // Should return null
    if (result === null) {
      console.log('✅ PASS - Correctly rejected invalid data');
      passed++;
    } else {
      console.log('❌ FAIL - Should have rejected invalid data');
      console.log('Got:', result);
      failed++;
    }
  } else {
    // Should parse successfully
    if (result === null) {
      console.log('❌ FAIL - Should have parsed valid data');
      console.log('Expected:', testCase.expected);
      failed++;
    } else {
      // Verify parsed data
      const errors: string[] = [];

      if (result.puzzleId !== testCase.expected.puzzleId) {
        errors.push(`puzzleId: expected "${testCase.expected.puzzleId}", got "${result.puzzleId}"`);
      }

      if (result.elo !== testCase.expected.elo) {
        errors.push(`elo: expected ${testCase.expected.elo}, got ${result.elo}`);
      }

      // Check themes are in tags
      const missingThemes = testCase.expected.themes.filter(t => !result.tags.includes(t));
      if (missingThemes.length > 0) {
        errors.push(`missing themes: ${missingThemes.join(', ')}`);
      }

      // Check openings are in tags
      const missingOpenings = testCase.expected.openings.filter(o => !result.tags.includes(o));
      if (missingOpenings.length > 0) {
        errors.push(`missing openings: ${missingOpenings.join(', ')}`);
      }

      // Check puzzleData is full CSV row
      if (!result.puzzleData.includes(result.puzzleId)) {
        errors.push('puzzleData does not contain full CSV row');
      }

      if (errors.length > 0) {
        console.log('❌ FAIL');
        errors.forEach(err => console.log(`  - ${err}`));
        console.log('Result:', result);
        failed++;
      } else {
        console.log('✅ PASS');
        console.log(`  puzzleId: ${result.puzzleId}`);
        console.log(`  elo: ${result.elo}`);
        console.log(`  tags: [${result.tags.join(', ')}]`);
        if (result.rawData) {
          console.log(`  themes: [${result.rawData.themes.join(', ')}]`);
          console.log(`  openings: [${result.rawData.openings.join(', ')}]`);
        }
        passed++;
      }
    }
  }

  console.log('');
}

console.log(`=== Summary ===`);
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

process.exit(failed > 0 ? 1 : 0);
