# Todo: WeightedCard Provenance Implementation

## Phase 1: Core Types & Helpers
- [ ] Add `StrategyContribution` interface to `index.ts`
- [ ] Update `WeightedCard` interface (remove `source`, add required `provenance`)
- [ ] Add `getCardOrigin()` helper function
- [ ] Update JSDoc comments

## Phase 2: Generator Navigators
- [ ] Update `ELONavigator.getWeightedCards()` - add provenance creation
- [ ] Update `HardcodedOrderNavigator.getWeightedCards()` - add provenance creation
- [ ] Update `CompositeGenerator.getWeightedCards()` - append merge/boost provenance

## Phase 3: Filter Navigators
- [ ] Update `HierarchyDefinitionNavigator.getWeightedCards()` - append provenance
- [ ] Update `InterferenceMitigatorNavigator.getWeightedCards()` - append provenance
- [ ] Update `RelativePriorityNavigator.getWeightedCards()` - append provenance

## Phase 4: SessionController Integration
- [ ] Add `getCardOrigin()` method to SessionController
- [ ] Update queue routing in `getWeightedContent()` to use provenance
- [ ] Fix any other references to `WeightedCard.source` in SessionController

## Phase 5: Tests
- [ ] Update existing navigator tests (remove `.source` assertions)
- [ ] Add provenance structure tests
- [ ] Add provenance tracking through pipeline tests
- [ ] Add reason field validation tests

## Phase 6: Documentation
- [ ] Update `navigators-architecture.md` with provenance examples
- [ ] Delete `todo-provenance.md`

## Phase 7: Final Validation
- [ ] Run full test suite (`yarn workspace @vue-skuilder/db build && test`)
- [ ] Check TypeScript compilation
- [ ] Verify no remaining references to `.source` field
