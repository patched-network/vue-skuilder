export interface ChessPosition {
  fen: string;
  lastMove?: Move;
  orientation?: 'cg-white' | 'cg-black';
}

export interface Move {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}
