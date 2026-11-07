// ==================== ENUMS ====================

export enum Afflatus {
  BEAST = 'BEAST',
  PLANT = 'PLANT',
  STAR = 'STAR',
  MINERAL = 'MINERAL',
  SPIRIT = 'SPIRIT',
  INTELLECT = 'INTELLECT',
}

export enum DamageType {
  REALITY = 'REALITY',
  MENTAL = 'MENTAL',
  GENESIS = 'GENESIS',
}

export enum ActionScalingType {
  INCANTATION = 'INCANTATION',
  ULTIMATE = 'ULTIMATE',
}

// ==================== STAT STRUCTURES ====================

/**
 * Base character stats before any modifiers
 */
export interface BaseStats {
  hp: number;
  atk: number;
  realityDef: number;
  mentalDef: number;
  technic: number; // Converted to Crit Rate & Crit DMG
}

/**
 * Resonance stat bonuses
 */
export interface ResonanceStats {
  // Flat bonuses applied before % multipliers
  flatATK: number;
  flatRealityDef: number;
  flatMentalDef: number;
  flatHP: number;
  
  // Percentage bonuses applied to (BaseStat + ResonanceFlat)
  atkPercent: number;
  realityDefPercent: number;
  mentalDefPercent: number;
  hpPercent: number;
  
  // Direct crit bonuses
  critRate: number;
  critDMG: number;
}

/**
 * Psychube stat bonuses
 */
export interface PsychubeStats {
  // Flat bonuses added AFTER Resonance
  flatATK: number;
  flatRealityDef: number;
  flatMentalDef: number;
  flatHP: number;
  
  // Orange passive buffs (these are InBattle buffs!)
  // Example: "When carrier enters battle, ATK +8%"
  // These will be applied as InBattle multipliers, not PreBattle
  passiveATKPercent: number;
  passiveDMGBonus: number;
  passiveCritRate: number;
  passiveCritDMG: number;
  passivePenetration: number;
}

/**
 * Pre-Battle stats (displayed on character screen before entering battle)
 */
export interface PreBattleStats {
  hp: number;
  atk: number;
  realityDef: number;
  mentalDef: number;
  critRate: number;
  critDMG: number;
}

/**
 * In-Battle stat modifiers (buffs/debuffs active during combat)
 */
export interface InBattleModifiers {
  // Stat multipliers (green/red buffs from skills, Insight 2 passives, Portrait passives, Psychube orange passives)
  atkPercent: number;
  realityDefPercent: number;
  mentalDefPercent: number;
  
  // Flat stat additions during battle
  flatATK: number;
  flatRealityDef: number;
  flatMentalDef: number;
  
  // Damage calculation modifiers
  dmgBonus: number; // Attacker's DMG Dealt Up%
  dmgReduction: number; // Target's DMG Reduction%
  dmgTakenUp: number; // Target's DMG Taken Up%
  
  incantationMight: number;
  ultimateMight: number;
  genesisDMGBonus: number;
  
  critRate: number;
  critDMG: number;
  
  penetration: number; // DEF Penetration Rate
  
  // Target-specific modifiers
  defDown: number; // Target's DEF Down%
  flatDefDown: number; // Target's Flat DEF Down
  critResist: number; // Target's Crit Resist%
  critDef: number; // Target's Crit DEF%
  
  // Afflatus advantage bonus (from Psychube like "Balance, Please")
  afflatusAdvantageBonus: number;
  
  // Excess Crit Conversion flag & rate
  excessCritConversionEnabled: boolean;
  excessCritConversionRate: number; // e.g., 0.50 = 50% of excess crit → crit DMG
}

/**
 * In-Battle computed stats (PreBattle × InBattle modifiers)
 */
export interface InBattleStats {
  atk: number;
  realityDef: number;
  mentalDef: number;
  critRate: number;
  critDMG: number;
}

// ==================== CHARACTER CONFIGURATION ====================

export interface CharacterConfig {
  name: string;
  afflatus: Afflatus;
  
  // Character build
  level: number; // 1-60
  insight: 0 | 1 | 2 | 3;
  portrait: 0 | 1 | 2 | 3 | 4 | 5;
  
  // Base stats at this level & insight
  baseStats: BaseStats;
  
  // Resonance configuration
  resonance: ResonanceStats;
  
  // Psychube configuration
  psychube: PsychubeStats;
}

// ==================== DUMMY TARGET CONFIGURATION ====================

export interface DummyConfig {
  name: string;
  afflatus: Afflatus;
  
  // Pre-Battle DEF stats
  preBattleRealityDef: number;
  preBattleMentalDef: number;
  
  // Permanent modifiers
  dmgReduction: number;
  critResist: number;
  critDef: number;
  
  // Permanent debuffs (e.g., pre-applied DEF Down)
  permanentDefDown: number;
  permanentFlatDefDown: number;
}

// ==================== DAMAGE CALCULATION RESULT ====================

/**
 * Detailed breakdown of every intermediate formula bucket
 * ALL intermediate values must be stored here for Unit Test verification and UI display
 */
export interface FormulaBreakdown {
  // Step 1: In-Battle ATK calculation
  preBattleATK: number;
  inBattleATKPercent: number;
  inBattleFlatATK: number;
  inBattleATK: number; // Final attacker ATK
  
  // Step 2: Effective DEF calculation
  targetPreBattleDEF: number;
  totalDefDown: number;
  flatDefDown: number;
  defAfterDebuffs: number; // max(0, PreDEF × (1 - DefDown%) - FlatDefDown)
  attackerPenetration: number;
  effectiveDEF: number; // DefAfterDebuffs × (1 - Penetration)
  
  // Step 3: Base DMG calculation
  rawBaseDMG: number; // ATK - EffectiveDEF
  atkFloor: number; // ATK × 0.10
  baseDMG: number; // max(rawBaseDMG, atkFloor)
  
  // Step 4: DMG Bonus Multiplier (with 0.30 floor)
  attackerDMGBonus: number;
  inBattleDMGDealtUp: number;
  targetDMGReduction: number;
  targetDMGTakenUp: number;
  rawDMGMult: number; // 1 + DMGBonus + DMGDealtUp - DMGReduction + DMGTakenUp
  dmgMult: number; // max(0.30, rawDMGMult)
  
  // Step 5: Might Multiplier
  mightStat: number; // IncantationMight or UltimateMight
  mightMult: number; // 1 + MightStat
  
  // Step 6: Critical Multiplier (compute all 3 scenarios)
  attackerCritRate: number;
  targetCritResist: number;
  effectiveCritRate: number; // clamp(AttackerCritRate - TargetCritResist, 0, 1)
  excessCritRate: number; // max(0, (AttackerCritRate - TargetCritResist) - 1.0)
  
  attackerCritDMG: number;
  targetCritDef: number;
  convertedExcessCritDMG: number; // ExcessCritRate × ConversionRate (if enabled)
  rawEffectiveCritDMG: number; // AttackerCritDMG - TargetCritDef + ConvertedExcessCritDMG
  effectiveCritDMG: number; // max(1.10, rawEffectiveCritDMG)
  
  // Step 7: Afflatus Multiplier
  attackerAfflatus: Afflatus;
  targetAfflatus: Afflatus;
  afflatusAdvantage: boolean;
  afflatusAdvantageBonus: number;
  afflatusMult: number; // 1.30 + Bonus if advantage, else 1.00
  
  // Step 8: Skill Multiplier
  skillMultiplier: number; // e.g., 2.50 for a 250% skill
  
  // Step 9: Final DMG Multiplier (reserved for future use, default 1.0)
  finalDMGMult: number;
}

/**
 * Result of a single hit damage calculation
 */
export interface HitCalculationResult {
  // Three damage outputs
  nonCritDmg: number;
  critDmg: number;
  expectedDmg: number;
  
  // Full formula breakdown
  breakdown: FormulaBreakdown;
}

/**
 * Genesis damage calculation result (simpler formula)
 */
export interface GenesisHitResult {
  damage: number;
  breakdown: {
    scalingStat: number; // e.g., ATK or specific stat
    skillMultiplier: number;
    genesisDMGBonus: number;
    finalDamage: number;
  };
}
