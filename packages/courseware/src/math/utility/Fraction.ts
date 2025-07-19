class ProperFraction {
  readonly num: number; // numerator
  readonly den: number; // denominator

  private readonly rotation: number;
  /**
   *
   */
  constructor(num: number, den: number, rotation?: number) {
    if (den <= 0) throw new Error('Denominator of a fraction must be >= 1');
    if (num > den) throw new Error(`${num} / ${den} is not a proper fraction`);

    this.num = num;
    this.den = den;

    // for drawing pizza-slice representation
    this.rotation = rotation ? rotation : Math.random() * Math.PI * 2;
  }

  toString(): string {
    return `${this.num}/${this.den}`;
  }

  static sum(a: ProperFraction, b: ProperFraction): ProperFraction {
    if (a.den === b.den) {
      return new ProperFraction(a.num + b.num, a.den);
    }

    // todo: replace or suppliment w/ a lcm
    return new ProperFraction(a.num * b.den + b.num * a.den, a.den * b.den);
  }

  reduce(): ProperFraction {
    for (let i = 2; i <= this.num && i <= this.den; i++) {
      if (this.num % i === 0 && this.den % i === 0) {
        const num = this.num / i;
        const den = this.den / i;

        // return a reduced fraction
        return new ProperFraction(num, den, this.rotation);
      }
    }

    // if fraction is already in lowest terms, return the original
    return this;
  }

  hasReduction(): boolean {
    return this !== this.reduce();
  }

  simplify(): ProperFraction {
    let reduced = this.reduce();
    while (reduced.hasReduction()) {
      reduced = reduced.reduce();
    }
    return reduced;
  }

  getCanvasDrawing(size: number): HTMLCanvasElement {
    if (size === undefined) {
      console.log('Fraction defaulting to 100 px');
      size = 100;
    }

    const canvas = document.createElement('canvas');
    canvas.height = size;
    canvas.width = size;
    const con = canvas.getContext('2d')!;

    const mid = size / 2;
    const radius = mid * 0.9;
    const angle = (2 * Math.PI) / this.den;

    con.fillStyle = 'orange';

    con.translate(mid, mid);
    con.rotate(this.rotation);
    con.translate(-mid, -mid);

    // the 'arc' fills
    for (let i = 0; i < this.num; i++) {
      con.beginPath();
      con.arc(mid, mid, radius, angle * i, angle * (i + 1));
      con.fill();
    }

    // the 'triangular' segments
    con.beginPath();
    con.moveTo(mid, mid);
    for (let i = 0; i <= this.num; i++) {
      con.lineTo(mid + radius * Math.cos(angle * i), mid + radius * Math.sin(angle * i));
    }
    con.moveTo(mid, mid);
    con.fill();

    // the dividing spokes
    if (this.den > 1) {
      // prevents drawing of 'solitary' spoke in 1/1
      for (let i = 0; i < this.den; i++) {
        con.beginPath();
        con.moveTo(mid, mid);
        con.lineTo(mid + radius * Math.cos(i * angle), mid + radius * Math.sin(i * angle));
        con.stroke();
      }
    }

    // the exterior circle
    con.beginPath();
    con.arc(mid, mid, radius, 0, 2 * Math.PI);
    con.stroke();

    return canvas;
  }

  getSquareCanvasDrawing(size: number): HTMLCanvasElement {
    // todo: Do we want the area of a circle representation
    // and a square representation to be equal for a given 'size' input?

    // todo: must be rotatable (by 90)

    // todo: prime check on the den, followed by horiz + vertically cut 'whole'.
    if (!size) {
      size = 100;
    }

    const canvas = document.createElement('canvas');
    canvas.height = size;
    canvas.width = size;
    const con = canvas.getContext('2d')!;

    con.translate(size / 20, size / 20);
    size = 0.9 * size;

    // The 'filled in' bits
    con.fillStyle = 'orange';
    for (let i = 0; i < this.num; i++) {
      con.fillRect((i * size) / this.den, 0, size / this.den, size);
    }

    // The vertical bars
    for (let i = 1; i < this.den; i++) {
      con.beginPath();
      con.moveTo((i * size) / this.den, 0);
      con.lineTo((i * size) / this.den, size);
      con.stroke();
    }

    // the outer box
    con.strokeRect(0, 0, size, size);

    return canvas;
  }
}

export default ProperFraction;
