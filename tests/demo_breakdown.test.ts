import { describe, it, expect } from 'vitest';
import { calculateStandardHit } from '../src/engine/formula';
import { Afflatus, ActionScalingType, DummyConfig, InBattleModifiers } from '../src/engine/types';

describe('DEMO: Complete Formula Breakdown Verification', () => {
  it('should store ALL intermediate values in FormulaBreakdown for UI display', () => {
    // Setup: DPS character hitting a standard dummy
    const preBattle = {
      hp: 5000,
      atk: 1500,
      realityDef: 300,
      mentalDef: 280,
      critRate: 0.60, // 60% Crit Rate
      critDMG: 1.80, // 180% Crit DMG
    };

    const attackerModifiers: InBattleModifiers = {
      atkPercent: 0.15, // +15% ATK from buffs
      realityDefPercent: 0,
      mentalDefPercent: 0,
      flatATK: 100, // +100 flat ATK
      flatRealityDef: 0,
      flatMentalDef: 0,
      dmgBonus: 0.25, // +25% DMG Bonus
      dmgReduction: 0,
      dmgTakenUp: 0,
      incantationMight: 0.12, // +12% Incantation Might
      ultimateMight: 0,
      genesisDMGBonus: 0,
      critRate: 0.05, // +5% Crit Rate from skill
      critDMG: 0.20, // +20% Crit DMG from skill
      penetration: 0.18, // 18% Penetration
      defDown: 0,
      flatDefDown: 0,
      critResist: 0,
      critDef: 0,
      afflatusAdvantageBonus: 0.05, // +5% from Psychube "Balance, Please"
      excessCritConversionEnabled: false,
      excessCritConversionRate: 0,
    };

    const dummy: DummyConfig = {
      name: 'Standard 600 DEF Dummy',
      afflatus: Afflatus.PLANT,
      preBattleRealityDef: 600,
      preBattleMentalDef: 500,
      dmgReduction: 0.10, // 10% DMG Reduction
      critResist: 0.05, // 5% Crit Resist
      critDef: 0.10, // 10% Crit DEF
      permanentDefDown: 0,
      permanentFlatDefDown: 0,
    };

    const targetModifiers: InBattleModifiers = {
      atkPercent: 0,
      realityDefPercent: 0,
      mentalDefPercent: 0,
      flatATK: 0,
      flatRealityDef: 0,
      flatMentalDef: 0,
      dmgBonus: 0,
      dmgReduction: 0,
      dmgTakenUp: 0.08, // Target has 8% DMG Taken Up debuff
      incantationMight: 0,
      ultimateMight: 0,
      genesisDMGBonus: 0,
      critRate: 0,
      critDMG: 0,
      penetration: 0,
      defDown: 0.15, // 15% DEF Down debuff
      flatDefDown: 50, // 50 Flat DEF Down
      critResist: 0,
      critDef: 0,
      afflatusAdvantageBonus: 0,
      excessCritConversionEnabled: false,
      excessCritConversionRate: 0,
    };

    const result = calculateStandardHit(
      preBattle,
      attackerModifiers,
      Afflatus.BEAST, // Beast > Plant advantage
      dummy,
      targetModifiers,
      2.80, // 280% skill multiplier (e.g., P5 Ultimate)
      ActionScalingType.INCANTATION,
      true // Reality damage
    );

    // ========== VERIFY EVERY SINGLE STEP ==========

    // STEP 1: In-Battle ATK
    expect(result.breakdown.preBattleATK).toBe(1500);
    expect(result.breakdown.inBattleATKPercent).toBe(0.15);
    expect(result.breakdown.inBattleFlatATK).toBe(100);
    expect(result.breakdown.inBattleATK).toBe(1500 * 1.15 + 100); // 1825

    // STEP 2: Effective DEF
    expect(result.breakdown.targetPreBattleDEF).toBe(600);
    expect(result.breakdown.totalDefDown).toBe(0.15);
    expect(result.breakdown.flatDefDown).toBe(50);
    expect(result.breakdown.defAfterDebuffs).toBe(600 * (1 - 0.15) - 50); // 460
    expect(result.breakdown.attackerPenetration).toBe(0.18);
    expect(result.breakdown.effectiveDEF).toBe(460 * (1 - 0.18)); // 377.2

    // STEP 3: Base DMG
    expect(result.breakdown.rawBaseDMG).toBeCloseTo(1825 - 377.2, 1); // 1447.8
    expect(result.breakdown.atkFloor).toBe(1825 * 0.10); // 182.5
    expect(result.breakdown.baseDMG).toBeGreaterThan(result.breakdown.atkFloor);
    expect(result.breakdown.baseDMG).toBeCloseTo(1447.8, 1);

    // STEP 4: DMG Bonus Multiplier
    expect(result.breakdown.attackerDMGBonus).toBe(0.25);
    expect(result.breakdown.targetDMGReduction).toBe(0.10);
    expect(result.breakdown.targetDMGTakenUp).toBe(0.08);
    // rawDMGMult = 1 + 0.25 + 0.25 - 0.10 + 0.08 = 1.48
    expect(result.breakdown.rawDMGMult).toBeCloseTo(1.48, 2);
    expect(result.breakdown.dmgMult).toBeCloseTo(1.48, 2);

    // STEP 5: Might Multiplier
    expect(result.breakdown.mightStat).toBe(0.12);
    expect(result.breakdown.mightMult).toBe(1.12);

    // STEP 6: Critical Multiplier
    expect(result.breakdown.attackerCritRate).toBeCloseTo(0.60 + 0.05, 2); // 0.65
    expect(result.breakdown.targetCritResist).toBe(0.05);
    expect(result.breakdown.effectiveCritRate).toBeCloseTo(0.60, 2); // 0.65 - 0.05 = 0.60
    expect(result.breakdown.excessCritRate).toBe(0); // No excess (< 100%)
    
    expect(result.breakdown.attackerCritDMG).toBeCloseTo(1.80 + 0.20, 2); // 2.00
    expect(result.breakdown.targetCritDef).toBe(0.10);
    expect(result.breakdown.convertedExcessCritDMG).toBe(0);
    expect(result.breakdown.effectiveCritDMG).toBeCloseTo(2.00 - 0.10, 2); // 1.90

    // STEP 7: Afflatus Multiplier
    expect(result.breakdown.attackerAfflatus).toBe(Afflatus.BEAST);
    expect(result.breakdown.targetAfflatus).toBe(Afflatus.PLANT);
    expect(result.breakdown.afflatusAdvantage).toBe(true);
    expect(result.breakdown.afflatusAdvantageBonus).toBe(0.05);
    expect(result.breakdown.afflatusMult).toBeCloseTo(1.35, 2); // 1.30 + 0.05

    // STEP 8: Skill Multiplier
    expect(result.breakdown.skillMultiplier).toBe(2.80);

    // STEP 9: Final DMG Multiplier
    expect(result.breakdown.finalDMGMult).toBe(1.0);

    // ========== VERIFY FINAL DAMAGE OUTPUTS ==========
    
    // Non-Crit DMG = BaseDMG × DMGMult × MightMult × 1.0 × AfflatusMult × SkillMult × FinalMult
    const expectedNonCrit = Math.floor(
      result.breakdown.baseDMG *
      result.breakdown.dmgMult *
      result.breakdown.mightMult *
      1.0 *
      result.breakdown.afflatusMult *
      result.breakdown.skillMultiplier *
      result.breakdown.finalDMGMult
    );
    expect(result.nonCritDmg).toBeCloseTo(expectedNonCrit, 0);

    // Crit DMG = BaseDMG × DMGMult × MightMult × EffectiveCritDMG × AfflatusMult × SkillMult × FinalMult
    const expectedCrit = Math.floor(
      result.breakdown.baseDMG *
      result.breakdown.dmgMult *
      result.breakdown.mightMult *
      result.breakdown.effectiveCritDMG *
      result.breakdown.afflatusMult *
      result.breakdown.skillMultiplier *
      result.breakdown.finalDMGMult
    );
    expect(result.critDmg).toBeCloseTo(expectedCrit, 0);

    // Expected DMG (Average)
    const critMultAvg = 1 + result.breakdown.effectiveCritRate * (result.breakdown.effectiveCritDMG - 1);
    const expectedAvg = Math.floor(
      result.breakdown.baseDMG *
      result.breakdown.dmgMult *
      result.breakdown.mightMult *
      critMultAvg *
      result.breakdown.afflatusMult *
      result.breakdown.skillMultiplier *
      result.breakdown.finalDMGMult
    );
    expect(result.expectedDmg).toBeCloseTo(expectedAvg, 0);

    // Final sanity checks
    expect(result.critDmg).toBeGreaterThan(result.expectedDmg);
    expect(result.expectedDmg).toBeGreaterThan(result.nonCritDmg);

    // Log để demo
    console.log('=== COMPLETE FORMULA BREAKDOWN ===');
    console.log(`Pre-Battle ATK: ${result.breakdown.preBattleATK}`);
    console.log(`In-Battle ATK: ${result.breakdown.inBattleATK} (${result.breakdown.preBattleATK} × ${1 + result.breakdown.inBattleATKPercent} + ${result.breakdown.inBattleFlatATK})`);
    console.log(`Effective DEF: ${result.breakdown.effectiveDEF.toFixed(1)}`);
    console.log(`Base DMG: ${result.breakdown.baseDMG.toFixed(1)}`);
    console.log(`DMG Mult: ${result.breakdown.dmgMult.toFixed(2)}`);
    console.log(`Might Mult: ${result.breakdown.mightMult}`);
    console.log(`Effective Crit Rate: ${(result.breakdown.effectiveCritRate * 100).toFixed(1)}%`);
    console.log(`Effective Crit DMG: ${(result.breakdown.effectiveCritDMG * 100).toFixed(1)}%`);
    console.log(`Afflatus Mult: ${result.breakdown.afflatusMult.toFixed(2)} (${result.breakdown.afflatusAdvantage ? 'Advantage' : 'Neutral'})`);
    console.log(`Skill Mult: ${result.breakdown.skillMultiplier}`);
    console.log('=== DAMAGE OUTPUTS ===');
    console.log(`Non-Crit: ${result.nonCritDmg.toLocaleString()}`);
    console.log(`Crit: ${result.critDmg.toLocaleString()}`);
    console.log(`Expected (Avg): ${result.expectedDmg.toLocaleString()}`);
  });
});
