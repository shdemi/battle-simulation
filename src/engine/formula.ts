import {
  Afflatus,
  BaseStats,
  ResonanceStats,
  PsychubeStats,
  PreBattleStats,
  InBattleModifiers,
  InBattleStats,
  DummyConfig,
  ActionScalingType,
  HitCalculationResult,
  GenesisHitResult,
  FormulaBreakdown,
} from './types';

// ==================== UTILITY FUNCTIONS ====================

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check if attacker has Afflatus advantage over target
 * Beast > Plant > Star > Mineral > Beast (cycle)
 * Spirit <-> Intellect (mutual advantage)
 */
export function hasAfflatusAdvantage(attacker: Afflatus, target: Afflatus): boolean {
  if (attacker === Afflatus.BEAST && target === Afflatus.PLANT) return true;
  if (attacker === Afflatus.PLANT && target === Afflatus.STAR) return true;
  if (attacker === Afflatus.STAR && target === Afflatus.MINERAL) return true;
  if (attacker === Afflatus.MINERAL && target === Afflatus.BEAST) return true;
  if (attacker === Afflatus.SPIRIT && target === Afflatus.INTELLECT) return true;
  if (attacker === Afflatus.INTELLECT && target === Afflatus.SPIRIT) return true;
  return false;
}

// ==================== STAT CALCULATION FUNCTIONS ====================

/**
 * Convert Technic stat to Base Crit Rate and Base Crit DMG
 * BaseCritRate = Technic / 1000 (10 Technic = 1% Crit Rate)
 * BaseCritDMG = 1.30 + Technic / 2000 (10 Technic = 0.5% Crit DMG, plus 130% base)
 */
export function convertTechnicToCrit(technic: number): { critRate: number; critDMG: number } {
  const critRate = technic / 1000;
  const critDMG = 1.30 + technic / 2000;
  return { critRate, critDMG };
}

/**
 * Calculate Pre-Battle Stats (displayed on character screen before entering battle)
 * Formula: PreBattleStat = floor((BaseStat + ResonanceFlat) × (1 + Resonance%)) + PsychubeFlat
 */
export function calculatePreBattleStats(
  baseStats: BaseStats,
  resonance: ResonanceStats,
  psychube: PsychubeStats
): PreBattleStats {
  // HP
  const hpBeforePercent = baseStats.hp + resonance.flatHP;
  const hpAfterPercent = Math.floor(hpBeforePercent * (1 + resonance.hpPercent));
  const hp = hpAfterPercent + psychube.flatHP;

  // ATK
  const atkBeforePercent = baseStats.atk + resonance.flatATK;
  const atkAfterPercent = Math.floor(atkBeforePercent * (1 + resonance.atkPercent));
  const atk = atkAfterPercent + psychube.flatATK;

  // Reality DEF
  const realityDefBeforePercent = baseStats.realityDef + resonance.flatRealityDef;
  const realityDefAfterPercent = Math.floor(realityDefBeforePercent * (1 + resonance.realityDefPercent));
  const realityDef = realityDefAfterPercent + psychube.flatRealityDef;

  // Mental DEF
  const mentalDefBeforePercent = baseStats.mentalDef + resonance.flatMentalDef;
  const mentalDefAfterPercent = Math.floor(mentalDefBeforePercent * (1 + resonance.mentalDefPercent));
  const mentalDef = mentalDefAfterPercent + psychube.flatMentalDef;

  // Crit Rate & Crit DMG from Technic
  const technicCrit = convertTechnicToCrit(baseStats.technic);
  const critRate = technicCrit.critRate + resonance.critRate;
  const critDMG = technicCrit.critDMG + resonance.critDMG;

  return {
    hp,
    atk,
    realityDef,
    mentalDef,
    critRate,
    critDMG,
  };
}

/**
 * Calculate In-Battle Stats (computed dynamically on every hit)
 * CRITICAL RULE: Insight 2 passives, Portrait passives, and Psychube orange passives
 * are In-Battle Buffs that multiply against PreBattleStat, NOT BaseStat.
 * 
 * Formula: InBattleStat = PreBattleStat × (1 + ΣInBattleStatUp% - ΣInBattleStatDown%) + ΣInBattleFlatBuffs
 */
export function calculateInBattleStats(
  preBattle: PreBattleStats,
  modifiers: InBattleModifiers
): InBattleStats {
  // ATK
  const atk = preBattle.atk * (1 + modifiers.atkPercent) + modifiers.flatATK;

  // Reality DEF
  const realityDef = preBattle.realityDef * (1 + modifiers.realityDefPercent) + modifiers.flatRealityDef;

  // Mental DEF
  const mentalDef = preBattle.mentalDef * (1 + modifiers.mentalDefPercent) + modifiers.flatMentalDef;

  // Crit Rate & Crit DMG
  const critRate = preBattle.critRate + modifiers.critRate;
  const critDMG = preBattle.critDMG + modifiers.critDMG;

  return {
    atk,
    realityDef,
    mentalDef,
    critRate,
    critDMG,
  };
}

// ==================== DAMAGE CALCULATION FUNCTIONS ====================

/**
 * Calculate Standard Hit Damage (Reality or Mental)
 * Strictly follows Section 2.4 of IMPLEMENTATION_PLAN.md
 * ALL intermediate values are stored in FormulaBreakdown
 */
export function calculateStandardHit(
  attackerPreBattle: PreBattleStats,
  attackerModifiers: InBattleModifiers,
  attackerAfflatus: Afflatus,
  targetDummy: DummyConfig,
  targetModifiers: InBattleModifiers,
  skillMultiplier: number,
  scalingType: ActionScalingType,
  useRealityDef: boolean = true // true = Reality DMG, false = Mental DMG
): HitCalculationResult {
  // Initialize breakdown object
  const breakdown: FormulaBreakdown = {
    preBattleATK: 0,
    inBattleATKPercent: 0,
    inBattleFlatATK: 0,
    inBattleATK: 0,
    targetPreBattleDEF: 0,
    totalDefDown: 0,
    flatDefDown: 0,
    defAfterDebuffs: 0,
    attackerPenetration: 0,
    effectiveDEF: 0,
    rawBaseDMG: 0,
    atkFloor: 0,
    baseDMG: 0,
    attackerDMGBonus: 0,
    inBattleDMGDealtUp: 0,
    targetDMGReduction: 0,
    targetDMGTakenUp: 0,
    rawDMGMult: 0,
    dmgMult: 0,
    mightStat: 0,
    mightMult: 0,
    attackerCritRate: 0,
    targetCritResist: 0,
    effectiveCritRate: 0,
    excessCritRate: 0,
    attackerCritDMG: 0,
    targetCritDef: 0,
    convertedExcessCritDMG: 0,
    rawEffectiveCritDMG: 0,
    effectiveCritDMG: 0,
    attackerAfflatus: attackerAfflatus,
    targetAfflatus: targetDummy.afflatus,
    afflatusAdvantage: false,
    afflatusAdvantageBonus: 0,
    afflatusMult: 0,
    skillMultiplier: 0,
    finalDMGMult: 1.0,
  };

  // ========== STEP 1: Calculate In-Battle ATK ==========
  breakdown.preBattleATK = attackerPreBattle.atk;
  breakdown.inBattleATKPercent = attackerModifiers.atkPercent;
  breakdown.inBattleFlatATK = attackerModifiers.flatATK;
  breakdown.inBattleATK = breakdown.preBattleATK * (1 + breakdown.inBattleATKPercent) + breakdown.inBattleFlatATK;

  // ========== STEP 2: Calculate Effective DEF ==========
  breakdown.targetPreBattleDEF = useRealityDef ? targetDummy.preBattleRealityDef : targetDummy.preBattleMentalDef;
  breakdown.totalDefDown = targetModifiers.defDown + targetDummy.permanentDefDown;
  breakdown.flatDefDown = targetModifiers.flatDefDown + targetDummy.permanentFlatDefDown;
  breakdown.defAfterDebuffs = Math.max(
    0,
    breakdown.targetPreBattleDEF * (1 - breakdown.totalDefDown) - breakdown.flatDefDown
  );
  breakdown.attackerPenetration = attackerModifiers.penetration;
  breakdown.effectiveDEF = breakdown.defAfterDebuffs * (1 - breakdown.attackerPenetration);

  // ========== STEP 3: Calculate Base DMG (with 10% ATK Floor) ==========
  breakdown.rawBaseDMG = breakdown.inBattleATK - breakdown.effectiveDEF;
  breakdown.atkFloor = breakdown.inBattleATK * 0.10;
  breakdown.baseDMG = Math.max(breakdown.rawBaseDMG, breakdown.atkFloor);

  // ========== STEP 4: Calculate DMG Bonus Multiplier (with 0.30 Floor) ==========
  breakdown.attackerDMGBonus = attackerModifiers.dmgBonus;
  breakdown.inBattleDMGDealtUp = attackerModifiers.dmgBonus; // Same as attackerDMGBonus (kept separate for clarity)
  breakdown.targetDMGReduction = targetModifiers.dmgReduction + targetDummy.dmgReduction;
  breakdown.targetDMGTakenUp = targetModifiers.dmgTakenUp;
  breakdown.rawDMGMult =
    1 +
    breakdown.attackerDMGBonus +
    breakdown.inBattleDMGDealtUp -
    breakdown.targetDMGReduction +
    breakdown.targetDMGTakenUp;
  breakdown.dmgMult = Math.max(0.30, breakdown.rawDMGMult);

  // ========== STEP 5: Calculate Might Multiplier ==========
  if (scalingType === ActionScalingType.INCANTATION) {
    breakdown.mightStat = attackerModifiers.incantationMight;
  } else {
    breakdown.mightStat = attackerModifiers.ultimateMight;
  }
  breakdown.mightMult = 1 + breakdown.mightStat;

  // ========== STEP 6: Calculate Critical Multiplier ==========
  const attackerInBattle = calculateInBattleStats(attackerPreBattle, attackerModifiers);
  breakdown.attackerCritRate = attackerInBattle.critRate;
  breakdown.targetCritResist = targetModifiers.critResist + targetDummy.critResist;
  breakdown.effectiveCritRate = clamp(
    breakdown.attackerCritRate - breakdown.targetCritResist,
    0,
    1
  );
  breakdown.excessCritRate = Math.max(
    0,
    breakdown.attackerCritRate - breakdown.targetCritResist - 1.0
  );

  breakdown.attackerCritDMG = attackerInBattle.critDMG;
  breakdown.targetCritDef = targetModifiers.critDef + targetDummy.critDef;
  breakdown.convertedExcessCritDMG = attackerModifiers.excessCritConversionEnabled
    ? breakdown.excessCritRate * attackerModifiers.excessCritConversionRate
    : 0;
  breakdown.rawEffectiveCritDMG =
    breakdown.attackerCritDMG - breakdown.targetCritDef + breakdown.convertedExcessCritDMG;
  breakdown.effectiveCritDMG = Math.max(1.10, breakdown.rawEffectiveCritDMG);

  // ========== STEP 7: Calculate Afflatus Multiplier ==========
  breakdown.afflatusAdvantage = hasAfflatusAdvantage(breakdown.attackerAfflatus, breakdown.targetAfflatus);
  breakdown.afflatusAdvantageBonus = attackerModifiers.afflatusAdvantageBonus;
  breakdown.afflatusMult = breakdown.afflatusAdvantage
    ? 1.30 + breakdown.afflatusAdvantageBonus
    : 1.00;

  // ========== STEP 8: Skill Multiplier ==========
  breakdown.skillMultiplier = skillMultiplier;

  // ========== STEP 9: Calculate Final Damage (3 scenarios) ==========
  const baseFormula =
    breakdown.baseDMG *
    breakdown.dmgMult *
    breakdown.mightMult *
    breakdown.afflatusMult *
    breakdown.skillMultiplier *
    breakdown.finalDMGMult;

  const nonCritDmg = baseFormula * 1.0;
  const critDmg = baseFormula * breakdown.effectiveCritDMG;
  const critMultAvg = 1 + breakdown.effectiveCritRate * (breakdown.effectiveCritDMG - 1);
  const expectedDmg = baseFormula * critMultAvg;

  return {
    nonCritDmg: Math.floor(nonCritDmg),
    critDmg: Math.floor(critDmg),
    expectedDmg: Math.floor(expectedDmg),
    breakdown,
  };
}

/**
 * Calculate Genesis Hit Damage
 * Ignores DEF, Penetration, DMG Bonus/Reduction, Might, and Afflatus Advantage
 * Does NOT Crit by default unless character passive explicitly allows it
 */
export function calculateGenesisHit(
  scalingStat: number,
  skillMultiplier: number,
  genesisDMGBonus: number
): GenesisHitResult {
  const finalDamage = scalingStat * skillMultiplier * (1 + genesisDMGBonus);

  return {
    damage: Math.floor(finalDamage),
    breakdown: {
      scalingStat,
      skillMultiplier,
      genesisDMGBonus,
      finalDamage,
    },
  };
}
