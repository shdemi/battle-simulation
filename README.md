# Reverse: 1999 — 4-Character Rotation & Damage Simulator

## Project Status: PHASE 1 ✅ COMPLETE

### Phase 1 Deliverables:
- ✅ Vite + React + TypeScript + TailwindCSS + Vitest setup
- ✅ `src/engine/types.ts` - Complete type definitions for stats, configs, and formula breakdowns
- ✅ `src/engine/formula.ts` - Pure math formula engine with full breakdown tracking
- ✅ `tests/phase1_formula.test.ts` - 21 unit tests covering all formula edge cases
- ✅ All tests pass (21/21 ✓)
- ✅ TypeScript build passes with zero errors
- ✅ All intermediate formula values stored in `FormulaBreakdown` for UI display

### Key Features Implemented:
1. **Technic Conversion**: Converts Technic stat to Crit Rate (÷1000) and Crit DMG (130% base + ÷2000)
2. **Pre-Battle Stats**: `floor((BaseStat + ResonanceFlat) × (1 + Resonance%)) + PsychubeFlat`
3. **In-Battle Stats**: `PreBattleStat × (1 + InBattleStatUp% - InBattleStatDown%) + InBattleFlatBuffs`
4. **Standard Damage Formula**: Full implementation with all 9 steps:
   - Step 1: In-Battle ATK calculation
   - Step 2: Effective DEF (with DEF Down, Flat DEF Down, Penetration)
   - Step 3: Base DMG (with 10% ATK floor)
   - Step 4: DMG Bonus Multiplier (with 0.30 floor)
   - Step 5: Might Multiplier (Incantation/Ultimate)
   - Step 6: Critical Multiplier (with Excess Crit conversion support)
   - Step 7: Afflatus Multiplier (1.30 + bonus for advantage)
   - Step 8: Skill Multiplier
   - Step 9: Final DMG Multiplier
5. **Genesis Damage Formula**: Simplified formula ignoring DEF, DMG Bonus, Might, and Afflatus
6. **Three Damage Outputs**: Non-Crit, Crit, and Expected DMG for every hit
7. **Complete Formula Breakdown**: Every intermediate value stored in `FormulaBreakdown` object

### Test Coverage:
- Technic conversion (3 tests)
- Pre-Battle stat calculation (2 tests)
- In-Battle stat calculation (2 tests)
- Afflatus advantage detection (7 tests)
- Standard hit damage calculation (6 tests):
  - 10% ATK floor enforcement
  - 0.30 DMG Bonus floor enforcement
  - Penetration Rate calculation
  - Afflatus Advantage multiplier
  - Excess Crit conversion
  - Three damage output verification
- Genesis hit damage calculation (2 tests)

### Next Steps:
Awaiting user approval to proceed to **PHASE 2**: Buff Manager & Round/Action State Machine

## Development Commands
```bash
npm run dev       # Start dev server
npm run build     # TypeScript check + Production build
npm run test      # Run all tests
npm run test:watch # Run tests in watch mode
```

## Project Structure
```
battle simulation/
├── src/
│   ├── engine/
│   │   ├── types.ts       # Type definitions (Afflatus, Stats, Config, etc.)
│   │   └── formula.ts     # Pure math formula engine
│   ├── App.tsx            # React root component (placeholder)
│   ├── main.tsx           # React entry point
│   └── index.css          # TailwindCSS + global styles
├── tests/
│   └── phase1_formula.test.ts  # 21 unit tests (all passing)
├── raw_data/              # Game data from St-Pavlov-Foundation/re1999-data
├── IMPLEMENTATION_PLAN.md # Full project specification
└── package.json
```
