import { Question, ViewComponent } from '@vue-skuilder/common-ui';
import {
  Answer,
  DataShape,
  ViewData,
  DataShapeName,
  Status,
  FieldType,
} from '@vue-skuilder/common';
import PuzzleView from './puzzle.vue';
import { Key as cgKey } from '../../chessground/types';

export class ChessPuzzle extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: DataShapeName.CHESS_puzzle,
      fields: [
        {
          name: 'puzzleData', // see https://database.lichess.org/#puzzles
          type: FieldType.CHESS_PUZZLE,
          validator: {
            instructions: 'insert a valid fen string',
            test: function (s: string) {
              console.log(`running puzzle validator on ${s}`);

              if (!s) {
                return {
                  status: Status.error,
                  msg: 'no defined input',
                };
              }

              const split = s.split(',');
              if (split.length != 10) {
                return {
                  status: Status.error,
                  msg: 'puzzleData must have 8 comma-separated fields',
                };
              } else {
                return {
                  status: Status.ok,
                  msg: '',
                };
              }
            },
          },
          tagger: () => {
            // [ ] not actually used
            return ['test'];
          },
        },
      ],
    },
  ];
  public static views: ViewComponent[] = [PuzzleView];
  public static acceptsUserData: boolean = true;

  public static readonly CHECKMATE = 'CHECKMATE';

  public fen: string;
  id: string;
  moves: string[];
  rating: number;
  themes: string[];

  constructor(data: ViewData[]) {
    super(data);

    const [id, fen, movesStr, rating, , , , themes] = (data[0].puzzleData as string).split(',');
    this.id = id;
    this.fen = fen;
    this.moves = movesStr.split(' ');
    this.rating = parseInt(rating, 10);
    this.themes = themes.split(' ');
    // this.fen = data[0].fen as string;
  }

  public checkMove = (orig: cgKey, dest: cgKey) => {
    alert('checkMove');
    console.log('checkMove', orig, dest);
    console.log('this.moves[0]', this.moves[0]);

    if (this.moves[0] === dest) {
      return true;
    } else {
      return false;
    }
  };

  evaluate(a: Answer, t: number) {
    return {
      isCorrect: this.isCorrect(a),
      performance: this.displayedSkill(a, t),
    };
  }
  displayedSkill(a: Answer, t: number) {
    if (this.isCorrect(a)) {
      if (t < 5000) {
        return 1;
      } else {
        // scale from 1 at t=5s to 0,5 at t>=15s
        return 1 - Math.min(1, (t - 5000) / 10000);
      }
    }

    return 0;
  }
  dataShapes() {
    return ChessPuzzle.dataShapes;
  }

  views(): Array<ViewComponent> {
    return ChessPuzzle.views;
  }

  isCorrect(a: Answer) {
    // player actions have exhausted the move tree
    const sequenceComplete = this.moves.length === 0;

    return a === ChessPuzzle.CHECKMATE || sequenceComplete;
  }
}
