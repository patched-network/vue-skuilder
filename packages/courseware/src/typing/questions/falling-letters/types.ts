/** A falling letter. `x` is a percentage of the play area's width, `y` pixels from its top. */
export interface Letter {
  id: number;
  char: string;
  x: number;
  y: number;
}

/** A burst where a letter was destroyed (or hit the ground). */
export interface Burst {
  id: number;
  x: number;
  y: number;
  impact: boolean;
}

/** One building of the skyline. Positions and sizes in percent of the play area. */
export interface Building {
  id: number;
  left: number;
  width: number;
  height: number;
}
