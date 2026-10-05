import { CourseWare } from '../CourseWare';
import { SingleDigitAdditionQuestion } from './questions/addition';
import { SingleDigitDivisionQuestion } from './questions/division';
import { SingleDigitMultiplicationQuestion } from './questions/multiplication';
import { EqualityTest } from './questions/equalityTest';
import { OneStepEquation } from './questions/oneStepEqn';
import { AngleCategorize } from './questions/angleCategorize';
import { SupplementaryAngles } from './questions/supplementaryAngles';
import { CountBy } from './questions/countBy';
import { NumberBond } from './questions/numberBond';
import { BridgeTen } from './questions/bridgeTen';
import { DecadeFact } from './questions/decadeFact';

const math: CourseWare = new CourseWare('math', [
  SingleDigitDivisionQuestion,
  SingleDigitMultiplicationQuestion,
  SingleDigitAdditionQuestion,
  EqualityTest,
  OneStepEquation,
  AngleCategorize,
  SupplementaryAngles,
  CountBy,
  NumberBond,
  BridgeTen,
  DecadeFact,
]);

export default math;
