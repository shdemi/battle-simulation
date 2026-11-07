import { describe, it, expect } from 'vitest';
import {
  convertTechnicToCrit,
  calculatePreBattleStats,
  calculateInBattleStats,
  calculateStandardHit,
  calculateGenesisHit,
  hasAfflatusAdvantage,
} from '../src/engine/formula';
import {
  Afflatus,
  BaseStats,
  ResonanceStats,
  PsychubeStats,
  InBattleModifiers,
  ActionScalingType,
  DummyConfig,
} from '../src/engine/types';

describe('PHASE 1: Formula Engine Unit Tests', () => {
  // ==================== Technic Conversion Tests ====================
  describe('convertTechnicToCrit', () => {
    it('should convert Technic to Crit Rate and Crit DMG correctly', () => {
      // 100 Technic = 10% Crit Rate, 5% additional Crit DMG (base 130%)
      const result = convertTechnicToCrit(100);
      expect(result.critRate).toBeCloseTo(0.10, 4);
      expect(result.critDMG).toBeCloseTo(1.35, 4);
    });

    it('should handle 0 Technic', () => {
      const result = convertTechnicToCrit(0);
      expect(result.critRate).toBe(0);
      expect(result.critDMG).toBe(1.30);
    });

    it('should handle high Technic values', () => {
      // 500 Technic = 50% Crit Rate, 25% additional Crit DMG (total 155%)
      const result = convertTechnicToCrit(500);
      expect(result.critRate).toBeCloseTo(0.50, 4);
      expect(result.critDMG).toBeCloseTo(1.55, 4);
    });
  });

  // ==================== Pre-Battle Stats Tests ====================
  describe('calculatePreBattleStats', () => {
    it('should calculate Pre-Battle stats correctly with Resonance and Psychube', () => {
      const baseStats: BaseStats = {
        hp: 1000,
        atk: 500,
        realityDef: 200,
        mentalDef: 180,
        technic: 100, // 10% Crit Rate, 135% Crit DMG
      };

      const resonance: ResonanceStats = {
        flatATK: 50,
        flatRealityDef: 0,
        flatMentalDef: 0,
        flatHP: 0,
        atkPercent: 0.08, // +8% ATK
        realityDefPercent: 0,
        mentalDefPercent: 0,
        hpPercent: 0,
        critRate: 0.05, // +5% Crit Rate
        critDMG: 0.10, // +10% Crit DMG
      };

      const psychube: PsychubeStats = {
        flatATK: 30,
        flatRealityDef: 0,
        flatMentalDef: 0,
        flatHP: 0,
        passiveATKPercent: 0,
        passiveDMGBonus: 0,
        passiveCritRate: 0,
        passiveCritDMG: 0,
        passivePenetration: 0,
      };

      const preBattle = calculatePreBattleStats(baseStats, resonance, psychube);

      // ATK = floor((500 + 50) × 1.08) + 30 = floor(594) + 30 = 624
      expect(preBattle.atk).toBe(624);

      // Crit Rate = 10% (from Technic) + 5% (Resonance) = 15%
      expect(preBattle.critRate).toBeCloseTo(0.15, 4);

      // Crit DMG = 135% (from Technic) + 10% (Resonance) = 145%
      expect(preBattle.critDMG).toBeCloseTo(1.45, 4);
    });

    it('should floor stat values before adding Psychube flat bonuses', () => {
      const baseStats: BaseStats = {
        hp: 1000,
        atk: 555, // Will test flooring behavior
        realityDef: 200,
        mentalDef: 180,
        technic: 0,
      };

      const resonance: ResonanceStats = {
        flatATK: 0,
        flatRealityDef: 0,
        flatMentalDef: 0,
        flatHP: 0,
        atkPercent: 0.07, // +7% ATK: 555 × 1.07 = 593.85 → floor(593.85) = 593
        realityDefPercent: 0,
        mentalDefPercent: 0,
        hpPercent: 0,
        critRate: 0,
        critDMG: 0,
      };

      const psychube: PsychubeStats = {
        flatATK: 10,
        flatRealityDef: 0,
        flatMentalDef: 0,
        flatHP: 0,
        passiveATKPercent: 0,
        passiveDMGBonus: 0,
        passiveCritRate: 0,
        passiveCritDMG: 0,
        passivePenetration: 0,
      };

      const preBattle = calculatePreBattleStats(baseStats, resonance, psychube);

      // ATK = floor(555 × 1.07) + 10 = 593 + 10 = 603
      expect(preBattle.atk).toBe(603);
    });
  });

  // ==================== In-Battle Stats Tests ====================
  describe('calculateInBattleStats', () => {
    it('should apply In-Battle modifiers to Pre-Battle stats (Insight 2 + Psychube orange passive)', () => {
      const preBattle = {
        hp: 5000,
        atk: 1000,
        realityDef: 300,
        mentalDef: 280,
        critRate: 0.20,
        critDMG: 1.50,
      };

      const modifiers: InBattleModifiers = {
        atkPercent: 0.08 + 0.12, // +8% from Insight 2 passive, +12% from Psychube orange passive
        realityDefPercent: 0,
        mentalDefPercent: 0,
        flatATK: 0,
        flatRealityDef: 0,
        flatMentalDef: 0,
        dmgBonus: 0,
        dmgReduction: 0,
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const inBattle = calculateInBattleStats(preBattle, modifiers);

      // InBattleATK = 1000 × (1 + 0.20) = 1200
      expect(inBattle.atk).toBe(1200);
    });

    it('should add flat buffs on top of percentage modifiers', () => {
      const preBattle = {
        hp: 5000,
        atk: 800,
        realityDef: 300,
        mentalDef: 280,
        critRate: 0.20,
        critDMG: 1.50,
      };

      const modifiers: InBattleModifiers = {
        atkPercent: 0.10,
        realityDefPercent: 0,
        mentalDefPercent: 0,
        flatATK: 50, // +50 flat ATK
        flatRealityDef: 0,
        flatMentalDef: 0,
        dmgBonus: 0,
        dmgReduction: 0,
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const inBattle = calculateInBattleStats(preBattle, modifiers);

      // InBattleATK = 800 × 1.10 + 50 = 880 + 50 = 930
      expect(inBattle.atk).toBeCloseTo(930, 2);
    });
  });

  // ==================== Afflatus Advantage Tests ====================
  describe('hasAfflatusAdvantage', () => {
    it('should detect Beast > Plant advantage', () => {
      expect(hasAfflatusAdvantage(Afflatus.BEAST, Afflatus.PLANT)).toBe(true);
    });

    it('should detect Plant > Star advantage', () => {
      expect(hasAfflatusAdvantage(Afflatus.PLANT, Afflatus.STAR)).toBe(true);
    });

    it('should detect Star > Mineral advantage', () => {
      expect(hasAfflatusAdvantage(Afflatus.STAR, Afflatus.MINERAL)).toBe(true);
    });

    it('should detect Mineral > Beast advantage', () => {
      expect(hasAfflatusAdvantage(Afflatus.MINERAL, Afflatus.BEAST)).toBe(true);
    });

    it('should detect Spirit <-> Intellect mutual advantage', () => {
      expect(hasAfflatusAdvantage(Afflatus.SPIRIT, Afflatus.INTELLECT)).toBe(true);
      expect(hasAfflatusAdvantage(Afflatus.INTELLECT, Afflatus.SPIRIT)).toBe(true);
    });

    it('should return false for neutral matchups', () => {
      expect(hasAfflatusAdvantage(Afflatus.BEAST, Afflatus.BEAST)).toBe(false);
      expect(hasAfflatusAdvantage(Afflatus.BEAST, Afflatus.STAR)).toBe(false);
      expect(hasAfflatusAdvantage(Afflatus.SPIRIT, Afflatus.BEAST)).toBe(false);
    });
  });

  // ==================== Standard Hit Damage Tests ====================
  describe('calculateStandardHit', () => {
    it('should calculate damage with 10% ATK floor enforced', () => {
      const preBattle = {
        hp: 5000,
        atk: 1000,
        realityDef: 300,
        mentalDef: 280,
        critRate: 0.20,
        critDMG: 1.50,
      };

      const attackerModifiers: InBattleModifiers = {
        atkPercent: 0,
        realityDefPercent: 0,
        mentalDefPercent: 0,
        flatATK: 0,
        flatRealityDef: 0,
        flatMentalDef: 0,
        dmgBonus: 0,
        dmgReduction: 0,
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const dummy: DummyConfig = {
        name: 'High DEF Dummy',
        afflatus: Afflatus.PLANT,
        preBattleRealityDef: 1200, // Much higher than ATK
        preBattleMentalDef: 1000,
        dmgReduction: 0,
        critResist: 0,
        critDef: 0,
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
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const result = calculateStandardHit(
        preBattle,
        attackerModifiers,
        Afflatus.BEAST,
        dummy,
        targetModifiers,
        2.0, // 200% skill multiplier
        ActionScalingType.INCANTATION,
        true
      );

      // BaseDMG should be 10% ATK floor = 1000 × 0.10 = 100
      expect(result.breakdown.baseDMG).toBe(100);
      expect(result.breakdown.atkFloor).toBe(100);
      expect(result.breakdown.rawBaseDMG).toBeLessThan(100);
    });

    it('should calculate damage with 0.30 DMG Bonus floor enforced', () => {
      const preBattle = {
        hp: 5000,
        atk: 1000,
        realityDef: 300,
        mentalDef: 280,
        critRate: 0.20,
        critDMG: 1.50,
      };

      const attackerModifiers: InBattleModifiers = {
        atkPercent: 0,
        realityDefPercent: 0,
        mentalDefPercent: 0,
        flatATK: 0,
        flatRealityDef: 0,
        flatMentalDef: 0,
        dmgBonus: -0.50, // -50% DMG Bonus (e.g., heavy debuff)
        dmgReduction: 0,
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const dummy: DummyConfig = {
        name: 'Standard Dummy',
        afflatus: Afflatus.PLANT,
        preBattleRealityDef: 300,
        preBattleMentalDef: 280,
        dmgReduction: 0.50, // +50% DMG Reduction
        critResist: 0,
        critDef: 0,
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
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const result = calculateStandardHit(
        preBattle,
        attackerModifiers,
        Afflatus.BEAST,
        dummy,
        targetModifiers,
        2.0,
        ActionScalingType.INCANTATION,
        true
      );

      // rawDMGMult = 1 + (-0.50) - 0.50 = 0, but should be floored to 0.30
      expect(result.breakdown.dmgMult).toBe(0.30);
      expect(result.breakdown.rawDMGMult).toBeLessThanOrEqual(0.30);
    });

    it('should apply Penetration Rate correctly', () => {
      const preBattle = {
        hp: 5000,
        atk: 1000,
        realityDef: 300,
        mentalDef: 280,
        critRate: 0.20,
        critDMG: 1.50,
      };

      const attackerModifiers: InBattleModifiers = {
        atkPercent: 0,
        realityDefPercent: 0,
        mentalDefPercent: 0,
        flatATK: 0,
        flatRealityDef: 0,
        flatMentalDef: 0,
        dmgBonus: 0,
        dmgReduction: 0,
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0.30, // 30% Penetration
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const dummy: DummyConfig = {
        name: 'Standard Dummy',
        afflatus: Afflatus.PLANT,
        preBattleRealityDef: 600,
        preBattleMentalDef: 500,
        dmgReduction: 0,
        critResist: 0,
        critDef: 0,
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
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const result = calculateStandardHit(
        preBattle,
        attackerModifiers,
        Afflatus.BEAST,
        dummy,
        targetModifiers,
        1.0,
        ActionScalingType.INCANTATION,
        true
      );

      // EffectiveDEF = 600 × (1 - 0.30) = 420
      expect(result.breakdown.effectiveDEF).toBe(420);
      expect(result.breakdown.defAfterDebuffs).toBe(600);
    });

    it('should apply Afflatus Advantage multiplier correctly', () => {
      const preBattle = {
        hp: 5000,
        atk: 1000,
        realityDef: 300,
        mentalDef: 280,
        critRate: 0.20,
        critDMG: 1.50,
      };

      const attackerModifiers: InBattleModifiers = {
        atkPercent: 0,
        realityDefPercent: 0,
        mentalDefPercent: 0,
        flatATK: 0,
        flatRealityDef: 0,
        flatMentalDef: 0,
        dmgBonus: 0,
        dmgReduction: 0,
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0.05, // +5% Afflatus Advantage Bonus (from Psychube)
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const dummy: DummyConfig = {
        name: 'Plant Dummy',
        afflatus: Afflatus.PLANT,
        preBattleRealityDef: 300,
        preBattleMentalDef: 280,
        dmgReduction: 0,
        critResist: 0,
        critDef: 0,
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
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const result = calculateStandardHit(
        preBattle,
        attackerModifiers,
        Afflatus.BEAST, // Beast > Plant
        dummy,
        targetModifiers,
        1.0,
        ActionScalingType.INCANTATION,
        true
      );

      // AfflatusMult = 1.30 + 0.05 = 1.35
      expect(result.breakdown.afflatusMult).toBeCloseTo(1.35, 4);
      expect(result.breakdown.afflatusAdvantage).toBe(true);
    });

    it('should calculate Excess Crit conversion correctly', () => {
      const preBattle = {
        hp: 5000,
        atk: 1000,
        realityDef: 300,
        mentalDef: 280,
        critRate: 1.30, // 130% Crit Rate
        critDMG: 1.50,
      };

      const attackerModifiers: InBattleModifiers = {
        atkPercent: 0,
        realityDefPercent: 0,
        mentalDefPercent: 0,
        flatATK: 0,
        flatRealityDef: 0,
        flatMentalDef: 0,
        dmgBonus: 0,
        dmgReduction: 0,
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: true,
        excessCritConversionRate: 0.50, // 50% of Excess Crit → Crit DMG
      };

      const dummy: DummyConfig = {
        name: 'Standard Dummy',
        afflatus: Afflatus.PLANT,
        preBattleRealityDef: 300,
        preBattleMentalDef: 280,
        dmgReduction: 0,
        critResist: 0,
        critDef: 0,
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
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const result = calculateStandardHit(
        preBattle,
        attackerModifiers,
        Afflatus.BEAST,
        dummy,
        targetModifiers,
        1.0,
        ActionScalingType.INCANTATION,
        true
      );

      // Excess Crit = 1.30 - 1.0 = 0.30
      // Converted Excess Crit DMG = 0.30 × 0.50 = 0.15 = +15% Crit DMG
      expect(result.breakdown.excessCritRate).toBeCloseTo(0.30, 4);
      expect(result.breakdown.convertedExcessCritDMG).toBeCloseTo(0.15, 4);
    });

    it('should calculate all 3 damage outputs (Non-Crit, Crit, Expected)', () => {
      const preBattle = {
        hp: 5000,
        atk: 1000,
        realityDef: 300,
        mentalDef: 280,
        critRate: 0.50, // 50% Crit Rate
        critDMG: 2.00, // 200% Crit DMG
      };

      const attackerModifiers: InBattleModifiers = {
        atkPercent: 0,
        realityDefPercent: 0,
        mentalDefPercent: 0,
        flatATK: 0,
        flatRealityDef: 0,
        flatMentalDef: 0,
        dmgBonus: 0,
        dmgReduction: 0,
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const dummy: DummyConfig = {
        name: 'Standard Dummy',
        afflatus: Afflatus.PLANT,
        preBattleRealityDef: 300,
        preBattleMentalDef: 280,
        dmgReduction: 0,
        critResist: 0,
        critDef: 0,
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
        dmgTakenUp: 0,
        incantationMight: 0,
        ultimateMight: 0,
        genesisDMGBonus: 0,
        critRate: 0,
        critDMG: 0,
        penetration: 0,
        defDown: 0,
        flatDefDown: 0,
        critResist: 0,
        critDef: 0,
        afflatusAdvantageBonus: 0,
        excessCritConversionEnabled: false,
        excessCritConversionRate: 0,
      };

      const result = calculateStandardHit(
        preBattle,
        attackerModifiers,
        Afflatus.BEAST,
        dummy,
        targetModifiers,
        2.0, // 200% skill multiplier
        ActionScalingType.INCANTATION,
        true
      );

      // Non-Crit DMG = BaseDMG × 2.0 × 1.0 (CritMult = 1.0)
      // Crit DMG = BaseDMG × 2.0 × 2.0 (CritMult = 2.0)
      // Expected DMG = BaseDMG × 2.0 × (1 + 0.5 × (2.0 - 1)) = BaseDMG × 2.0 × 1.5

      expect(result.critDmg).toBeGreaterThan(result.nonCritDmg);
      expect(result.expectedDmg).toBeGreaterThan(result.nonCritDmg);
      expect(result.expectedDmg).toBeLessThan(result.critDmg);

      // Verify ratio: Crit = NonCrit × 2.0
      expect(result.critDmg / result.nonCritDmg).toBeCloseTo(2.0, 1);

      // Verify ratio: Expected = NonCrit × 1.5
      expect(result.expectedDmg / result.nonCritDmg).toBeCloseTo(1.5, 1);
    });
  });

  // ==================== Genesis Hit Damage Tests ====================
  describe('calculateGenesisHit', () => {
    it('should calculate Genesis damage ignoring DEF and DMG Bonus', () => {
      const result = calculateGenesisHit(
        1000, // Scaling stat (e.g., ATK)
        2.5, // 250% skill multiplier
        0.20 // +20% Genesis DMG Bonus
      );

      // GenesisDMG = 1000 × 2.5 × (1 + 0.20) = 1000 × 2.5 × 1.20 = 3000
      expect(result.damage).toBe(3000);
      expect(result.breakdown.scalingStat).toBe(1000);
      expect(result.breakdown.skillMultiplier).toBe(2.5);
      expect(result.breakdown.genesisDMGBonus).toBe(0.20);
    });

    it('should calculate Genesis damage with 0 bonus', () => {
      const result = calculateGenesisHit(
        800,
        1.5,
        0
      );

      // GenesisDMG = 800 × 1.5 × 1.0 = 1200
      expect(result.damage).toBe(1200);
    });
  });
});
