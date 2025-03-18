import { Course } from '../Course';
import { SingleDigitAdditionQuestion } from './questions/addition';
import { SingleDigitDivisionQuestion } from './questions/division';
import { SingleDigitMultiplicationQuestion } from './questions/multiplication';
import { EqualityTest } from './questions/equalityTest';
import { OneStepEquation } from './questions/oneStepEqn';
import { AngleCategorize } from './questions/angleCategorize';
import { SupplementaryAngles } from './questions/supplementaryAngles';
import { CountBy } from './questions/countBy';

const math: Course = new Course('math', [
  SingleDigitDivisionQuestion,
  SingleDigitMultiplicationQuestion,
  SingleDigitAdditionQuestion,
  EqualityTest,
  OneStepEquation,
  AngleCategorize,
  SupplementaryAngles,
  CountBy,
]);

export default math;
