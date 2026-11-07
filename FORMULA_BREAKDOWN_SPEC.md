# Formula Breakdown — Complete Intermediate Value Tracking

Mọi bước tính toán trung gian trong công thức damage đều được lưu vào object `FormulaBreakdown` để:
1. **Unit Test Verification**: Kiểm tra từng bước riêng lẻ
2. **UI Display**: Hiển thị công thức chi tiết cho người dùng ở Phase 4

## Cấu trúc FormulaBreakdown

```typescript
interface FormulaBreakdown {
  // ========== STEP 1: In-Battle ATK Calculation ==========
  preBattleATK: number;              // ATK hiển thị trên màn hình stat trước khi vào battle
  inBattleATKPercent: number;        // Tổng % buff ATK trong battle (Insight 2, Psychube orange, skill buffs)
  inBattleFlatATK: number;           // Tổng flat ATK buff trong battle
  inBattleATK: number;               // ATK cuối cùng = PreBattleATK × (1 + %) + Flat

  // ========== STEP 2: Effective DEF Calculation ==========
  targetPreBattleDEF: number;        // DEF của target trước battle (Reality hoặc Mental)
  totalDefDown: number;              // Tổng % DEF Down (debuffs + permanent)
  flatDefDown: number;               // Tổng Flat DEF Down
  defAfterDebuffs: number;           // max(0, PreDEF × (1 - DefDown%) - FlatDefDown)
  attackerPenetration: number;       // % Penetration của attacker
  effectiveDEF: number;              // DefAfterDebuffs × (1 - Penetration)

  // ========== STEP 3: Base DMG (with 10% ATK Floor) ==========
  rawBaseDMG: number;                // ATK - EffectiveDEF (có thể âm)
  atkFloor: number;                  // ATK × 0.10 (sàn damage tối thiểu)
  baseDMG: number;                   // max(rawBaseDMG, atkFloor)

  // ========== STEP 4: DMG Bonus Multiplier (with 0.30 Floor) ==========
  attackerDMGBonus: number;          // DMG Bonus của attacker (từ Psychube, buffs)
  inBattleDMGDealtUp: number;        // DMG Dealt Up trong battle (thường giống attackerDMGBonus)
  targetDMGReduction: number;        // DMG Reduction của target
  targetDMGTakenUp: number;          // DMG Taken Up của target (debuff khiến target nhận damage cao hơn)
  rawDMGMult: number;                // 1 + DMGBonus + DMGDealtUp - DMGReduction + DMGTakenUp
  dmgMult: number;                   // max(0.30, rawDMGMult) — sàn 0.30

  // ========== STEP 5: Might Multiplier ==========
  mightStat: number;                 // IncantationMight hoặc UltimateMight (tùy skill type)
  mightMult: number;                 // 1 + MightStat

  // ========== STEP 6: Critical Multiplier ==========
  attackerCritRate: number;          // Crit Rate của attacker
  targetCritResist: number;          // Crit Resist của target
  effectiveCritRate: number;         // clamp(AttackerCritRate - TargetCritResist, 0, 1)
  excessCritRate: number;            // max(0, (AttackerCritRate - TargetCritResist) - 1.0)
  
  attackerCritDMG: number;           // Crit DMG của attacker
  targetCritDef: number;             // Crit DEF của target
  convertedExcessCritDMG: number;    // ExcessCritRate × ConversionRate (nếu có passive)
  rawEffectiveCritDMG: number;       // AttackerCritDMG - TargetCritDef + ConvertedExcessCritDMG
  effectiveCritDMG: number;          // max(1.10, rawEffectiveCritDMG) — sàn 110%

  // ========== STEP 7: Afflatus Multiplier ==========
  attackerAfflatus: Afflatus;        // Afflatus của attacker
  targetAfflatus: Afflatus;          // Afflatus của target
  afflatusAdvantage: boolean;        // Có advantage không? (Beast > Plant, Spirit <-> Intellect, etc.)
  afflatusAdvantageBonus: number;    // Bonus thêm từ Psychube (e.g., Balance, Please +5%)
  afflatusMult: number;              // 1.30 + Bonus nếu advantage, else 1.00

  // ========== STEP 8: Skill Multiplier ==========
  skillMultiplier: number;           // e.g., 2.50 cho skill 250%

  // ========== STEP 9: Final DMG Multiplier ==========
  finalDMGMult: number;              // Reserved cho tương lai (default 1.0)
}
```

## Công thức cuối cùng

```typescript
// Non-Crit DMG
nonCritDmg = baseDMG × dmgMult × mightMult × 1.0 × afflatusMult × skillMultiplier × finalDMGMult

// Crit DMG
critDmg = baseDMG × dmgMult × mightMult × effectiveCritDMG × afflatusMult × skillMultiplier × finalDMGMult

// Expected DMG (Average)
critMultAvg = 1 + effectiveCritRate × (effectiveCritDMG - 1)
expectedDmg = baseDMG × dmgMult × mightMult × critMultAvg × afflatusMult × skillMultiplier × finalDMGMult
```

## Ví dụ Unit Test Verification

```typescript
const result = calculateStandardHit(...);

// Kiểm tra từng bước riêng lẻ
expect(result.breakdown.preBattleATK).toBe(1000);
expect(result.breakdown.inBattleATK).toBe(1200); // 1000 × 1.20
expect(result.breakdown.effectiveDEF).toBe(420); // 600 × (1 - 0.30)
expect(result.breakdown.baseDMG).toBe(780); // 1200 - 420
expect(result.breakdown.dmgMult).toBeCloseTo(1.35, 2);
expect(result.breakdown.afflatusMult).toBeCloseTo(1.35, 2); // 1.30 + 0.05
```

## Quy tắc KHÔNG được rút gọn

❌ **KHÔNG** được gộp các bước như:
```typescript
// SAI - rút gọn thành 1 dòng
const finalATK = baseStats.atk * (1 + resonance.atkPercent + modifiers.atkPercent) + psychube.flatATK;
```

✅ **PHẢI** tách từng bước:
```typescript
// ĐÚNG - tách từng bước và lưu vào breakdown
const preBattleATK = Math.floor((baseStats.atk + resonance.flatATK) * (1 + resonance.atkPercent)) + psychube.flatATK;
breakdown.preBattleATK = preBattleATK;

const inBattleATK = preBattleATK * (1 + modifiers.atkPercent) + modifiers.flatATK;
breakdown.inBattleATKPercent = modifiers.atkPercent;
breakdown.inBattleFlatATK = modifiers.flatATK;
breakdown.inBattleATK = inBattleATK;
```

## Lợi ích của việc lưu từng bước

1. **Debug dễ dàng**: Khi damage sai, có thể kiểm tra từng bước để tìm lỗi
2. **Unit Test chính xác**: Có thể test từng multiplier riêng lẻ
3. **UI Transparency**: Người dùng có thể thấy chính xác công thức đã tính như thế nào
4. **Compliance với IMPLEMENTATION_PLAN.md**: Đáp ứng yêu cầu "detailed FormulaBreakdown object (logging every intermediate bucket value for UI inspection)"

---

**Phase 1 Status**: ✅ Complete — All 21 tests passing with full breakdown tracking
