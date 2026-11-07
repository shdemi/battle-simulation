# Reverse: 1999 — 4-Character Rotation & Damage Simulator (`r1999-sim`)

## 1. Project Overview & Strict Engineering Rules
Build a standalone, deterministic, text-only Web Application (Vite + React + TypeScript + TailwindCSS + Vitest) that simulates a 4-character team rotation hitting a configurable Dummy target across multiple rounds in *Reverse: 1999*.

### Core Rules for the AI Agent
1. **Zero Visual Bloat:** Do NOT use character icons, avatars, or animations. Build a dense, clean, dark-mode technical dashboard focused purely on numbers, state transitions, and math breakdowns.
2. **Strict Separation of Concerns:**
   - `scripts/`: Node/TS CLI scripts to extract and normalize raw game tables from `raw_data/` (`St-Pavlov-Foundation/re1999-data`).
   - `src/engine/`: Pure TypeScript battle math and deterministic state machine with **zero React dependencies**.
   - `src/data/`: Clean, strongly-typed TypeScript/JSON registries for Characters, Psychubes, Resonance presets, and Boss Dummies.
   - `src/components/`: React UI components that only render engine outputs and dispatch rotation edits.
3. **Phase-Gate Execution:** Complete ONE Phase at a time. Run `npm run test` (Vitest) and `npm run build` (`tsc`) at the end of each phase. **STOP and wait for user approval before starting the next phase.**

---

## 2. Canonical Reverse: 1999 Mathematical Specification (The Panopticon Standard)

### 2.1. Raw Data Normalization (`re1999-data` Conventions)
When parsing tables from `St-Pavlov-Foundation/re1999-data`:
1. **Permyriad / Permille Scaling:** Raw game tables store percentages as integers (e.g., `1500` or `150` for `15%`, `2000` or `20000` for `200%` multiplier). Always normalize rates to standard decimals (`0.15`, `2.00`) during extraction or inside the data layer, and verify against in-game skill descriptions.
2. **Technique (`technic`) Conversion:**
   - Base Character Critical Rate and Critical DMG are derived from the `technic` stat:
     $$\text{BaseCritRate} = \frac{\text{Technic}}{1000} \quad (10 \text{ Technic} = 1\% \text{ Crit Rate})$$
     $$\text{BaseCritDMG} = 1.30 + \frac{\text{Technic}}{2000} \quad (10 \text{ Technic} = 0.5\% \text{ Crit DMG, plus } 130\% \text{ base})$$

### 2.2. Pre-Battle vs. In-Battle Stat Calculation
* **Pre-Battle Stat (Displayed on the Character Stat Screen prior to battle):**
  $$\text{PreBattleStat} = \lfloor (\text{BaseStat}_{\text{Char+Insight+Level}} + \text{ResonanceFlat}) \times (1 + \text{Resonance\%}) \rfloor + \text{PsychubeFlat}$$
* **In-Battle Stat (Calculated Dynamically on Every Hit):**
  *CRITICAL RULE:* Insight 2 passives (e.g., "+8% ATK when entering battle"), Portrait passives, and Psychube orange passives (e.g., "When the carrier enters battle, ATK +X%") are **In-Battle Buffs**. They multiply against `PreBattleStat`, NOT `BaseStat`.
  $$\text{InBattleStat} = \text{PreBattleStat} \times \left(1 + \sum \text{InBattleStatUp\%} - \sum \text{InBattleStatDown\%}\right) + \sum \text{InBattleFlatBuffs}$$

### 2.3. Buff & Debuff Stacking Categories
Every status effect in the engine (`skill_buff`) must be categorized into one of 4 buckets:
1. `STAT_UP` / `STAT_DOWN` (Generic green/red stat buffs like ATK +20%, Reality DEF -15%): **Non-stackable per stat.** If multiple exist on the same entity, only the **single highest magnitude** value is active for calculation; all active instances still tick down their durations independently.
2. `POS_STATUS` / `NEG_STATUS` (Named statuses like *Empower Incantation*, *Rigidity*, *Confusion*, *Poison*): **Stackable across different status IDs.** Same-ID statuses follow their specific rule (`REFRESH_DURATION`, `ADD_STACKS`, or `INDEPENDENT`).
3. `COUNTER` / `EUREKA` / `MOXIE`: Resource pools with strict min/max caps (Moxie defaults to `0..5`).
4. `PERMANENT_PASSIVE` / `AURA`: Always active and additive within their respective multiplier bucket.

### 2.4. Standard Damage Formula (Reality & Mental)
For every individual hit of an Incantation, Ultimate, or Follow-up/Extra Action:

$$\text{HitDMG} = \text{BaseDMG} \times \text{DMGMult} \times \text{MightMult} \times \text{CritMult} \times \text{AfflatusMult} \times \text{SkillMultiplier} \times \text{FinalDMGMult}$$

1. **Base DMG (with 10% ATK Floor & Penetration):**
   $$\text{EffectiveDEF} = \max\Big(0, \text{TargetPreDEF} \times (1 - \text{TotalDEFDown\%}) - \text{FlatDEFDown}\Big) \times (1 - \text{AttackerPenetrationRate})$$
   $$\text{BaseDMG} = \max\Big(\text{AttackerInBattleATK} - \text{EffectiveDEF}, \text{AttackerInBattleATK} \times 0.10\Big)$$
2. **DMG Bonus Multiplier (with 0.30 Floor):**
   $$\text{DMGMult} = \max\Big(0.30, 1 + \text{AttackerDMGBonus} + \text{InBattleDMGDealtUp} - \text{TargetDMGReduction} + \text{TargetDMGTakenUp}\Big)$$
3. **Might Multiplier:**
   * Regular Incantation (Skill 1 / Skill 2): $\text{MightMult} = 1 + \text{IncantationMight}$
   * Ultimate: $\text{MightMult} = 1 + \text{UltimateMight}$
   * Extra Action / Follow-up: Scales with either `IncantationMight` or `UltimateMight` depending on the character's specific skill tag.
4. **Critical Multiplier (Always compute all 3 outputs per hit):**
   * $\text{EffectiveCritRate} = \text{clamp}(\text{AttackerCritRate} - \text{TargetCritResist}, 0, 1)$
   * $\text{ExcessCritRate} = \max(0, (\text{AttackerCritRate} - \text{TargetCritResist}) - 1.0)$ *(Only converted to Crit DMG if a character passive or buff explicitly enables Excess Crit Conversion).*
   * $\text{EffectiveCritDMG} = \max\Big(1.10, \text{AttackerCritDMG} - \text{TargetCritDEF} + \text{ConvertedExcessCritDMG}\Big)$
   * **Non-Crit DMG:** $\text{CritMult} = 1.0$
   * **Crit DMG:** $\text{CritMult} = \text{EffectiveCritDMG}$
   * **Expected Average DMG:** $\text{CritMult} = 1 + \text{EffectiveCritRate} \times (\text{EffectiveCritDMG} - 1)$
5. **Afflatus Multiplier:**
   * Advantageous Afflatus (Beast > Plant > Star > Mineral > Beast, or Spirit <-> Intellect): $1.30 + \text{AfflatusAdvantageBonus}$ (e.g., from Psychube *Balance, Please*).
   * Neutral Afflatus: $1.00$.

### 2.5. Genesis Damage Formula
* Ignores Target DEF, Penetration Rate, DMG Bonus/Reduction, Incantation/Ultimate Might, and Afflatus Advantage.
* Does NOT Crit by default unless a specific character passive explicitly allows Genesis DMG to Crit (e.g., 37's Insight).
* $\text{GenesisDMG} = \text{ScalingStat} \times \text{SkillMultiplier} \times (1 + \text{GenesisDMGBonus})$.

---

## 3. Phased Implementation Roadmap

### PHASE 1: Project Scaffolding & Pure Math Formula Engine
**Objective:** Initialize the repository and build the core stat and damage calculation functions with 100% unit test coverage.
**Tasks:**
1. Initialize Vite + React + TypeScript + TailwindCSS + Vitest.
2. Create `src/engine/types.ts`:
   - Define `Afflatus` (`BEAST`, `PLANT`, `STAR`, `MINERAL`, `SPIRIT`, `INTELLECT`), `DamageType` (`REALITY`, `MENTAL`, `GENESIS`), and `ActionScalingType` (`INCANTATION`, `ULTIMATE`).
   - Define `StatBlock`, `CharacterConfig` (Level, Insight 0–3, Portrait 0–5, Resonance 1–15 + preset, Psychube ID + Level 1–60 + Amp 1–5).
   - Define `DummyConfig` (Afflatus, Reality DEF, Mental DEF, DMG Reduction, Crit Resist, Crit DEF, Permanent Debuffs).
   - Define `HitCalculationResult` containing `nonCritDmg`, `critDmg`, `expectedDmg`, and a detailed `FormulaBreakdown` object (logging every intermediate bucket value for UI inspection).
3. Create `src/engine/formula.ts`:
   - Implement `convertTechnicToCrit()`, `calculatePreBattleStats()`, and `calculateInBattleStats()`.
   - Implement `calculateStandardHit()` and `calculateGenesisHit()` strictly following Section 2.
4. Create `tests/phase1_formula.test.ts`:
   - Write unit tests verifying: Technic conversion, Pre-Battle vs. In-Battle ATK% separation, 10% ATK floor, 0.30 DMG Bonus floor, Penetration math, Afflatus advantage, and Excess Crit conversion.
**Gate 1:** Run `npm run test` — all Phase 1 math tests must pass.

---

### PHASE 2: Buff Manager & Round/Action State Machine
**Objective:** Build the deterministic turn-based simulator that processes a sequence of player actions across Rounds 1 to N.
**Tasks:**
1. Create `src/engine/buffManager.ts`:
   - Implement `BuffInstance` tracking `id`, `name`, `category` (`STAT_UP`, `STAT_DOWN`, `POS_STATUS`, `NEG_STATUS`, `SPECIAL`), `effects` (stat modifiers), `durationRounds`, `remainingTriggers` (for single-hit/next-incantation buffs), and `stacks`.
   - Implement `getEffectiveStatModifiers(entityBuffs)` enforcing the **Non-Stackable highest-value rule** for `STAT_UP` and `STAT_DOWN`, while summing `POS_STATUS`, `NEG_STATUS`, and `SPECIAL`.
   - Implement lifecycle tick hooks: `onBattleStart()`, `onRoundStart()`, `onBeforeAction()`, `onAfterHit()`, `onAfterAction()`, `onRoundEnd()`.
2. Create `src/engine/battleSimulator.ts`:
   - Track 4-character team state (`moxie: 0..5`, `eureka`, active buffs, custom counters) and 1 Dummy target state (active debuffs, accumulated damage).
   - Track Round state (`roundNumber`, `apRemaining` defaulting to 4 AP per round).
   - Support Action Types in the Rotation Queue:
     - `CAST_SKILL_1` (Rank 1★, 2★, or 3★) — costs 1 AP, grants +1/+2/+3 Moxie.
     - `CAST_SKILL_2` (Rank 1★, 2★, or 3★) — costs 1 AP, grants +1/+2/+3 Moxie.
     - `CAST_ULTIMATE` — costs 1 AP, requires 5 Moxie, consumes 5 Moxie, grants 0 Moxie.
     - `MOVE_AND_MERGE` — costs 1 AP, grants +1 Moxie to the selected character.
     - `MOVE_NO_MERGE` — costs 1 AP, grants 0 Moxie.
     - `EXTRA_ACTION` (Follow-up) — triggered automatically by character hooks or manually inserted; costs 0 AP, grants 0 Moxie by default.
   - Flag invalid actions in the simulation output (e.g., casting Ultimate when Moxie < 5, or exceeding 4 AP in a round) with clear validation warnings without crashing.
3. Create `tests/phase2_simulator.test.ts`:
   - Test Moxie generation, Ultimate consumption, `STAT_UP` non-stacking override, 1-hit buff consumption, and round-end duration tick-down across a 3-round rotation.
**Gate 2:** Run `npm run test` — all Phase 2 state machine and buff lifecycle tests must pass.

---

### PHASE 3: Raw Data Extractor (`re1999-data`) & Core Data Registry
**Objective:** Build a CLI extractor script to parse raw game tables in `raw_data/` (from `St-Pavlov-Foundation/re1999-data`) into clean TypeScript blueprints, and populate initial Psychubes, Resonance Presets, and 2 reference Characters.
**Tasks:**
1. Inspect `raw_data/` (containing files such as `character`, `character_level`, `character_rank`, `skill`, `skill_effect`, `skill_ex_level`, `skill_passive_level`, `skill_buff`, `equip`, `equip_strengthen`, `equip_skill`, `monster`).
   *(Note: If `raw_data/` files are not yet copied by the user, create the parser utility with mock schemas first and prompt the user to drop the files into `raw_data/`).*
2. Create `scripts/extract-game-data.ts`:
   - Build a Node/TS script (`npx tsx scripts/extract-game-data.ts --char <id_or_name>`) that reads `raw_data/` and outputs a structured summary/skeleton for a character:
     - Base stats at Insight 3 Level 60 (`character_level` + `character_rank`).
     - Skill 1, Skill 2 (1★/2★/3★) and Ultimate multipliers across Portrait 0 to Portrait 5 (`skill` + `skill_ex_level` + `skill_effect`).
     - Insight 1, 2, 3 passive descriptions and associated `skill_buff` IDs.
3. Create `src/data/resonancePresets.ts`:
   - Provide standard Resonance 10 and Resonance 15 stat presets (`R10_CRIT`, `R10_ATK`, `R15_CRIT`, `R15_ATK`) plus a `CUSTOM` mode where the user can input exact Resonance % and flat stats.
4. Create `src/data/psychubes.ts`:
   - Extract/implement 5 staple 6★ Psychubes at Lv60 (Amp 1–5) from `equip` tables (e.g., *Brave New World*, *Blasphemer of Night*, *Outside the City*, *Balance, Please*, *His Bounden Duty*).
5. Create `src/data/characters/`:
   - Define the `CharacterBlueprint` interface supporting base stats, P0–P5 skill multiplier tables, Insight 1–3 hooks, and custom mechanic triggers.
   - Implement **2 complete reference characters** (1 Main DPS + 1 Support/Debuffer) extracted from `raw_data/` to validate cross-character buffs/debuffs in a 4-man team.
6. Create `tests/phase3_data.test.ts`:
   - Verify Portrait scaling (P0 vs P5 damage difference), Psychube amplification scaling (A1 vs A5), and Support-to-DPS synergy against the Dummy.
**Gate 3:** Run `npm run test` — all Phase 3 data and character synergy tests must pass.

---

### PHASE 4: 3-Column Technical Web UI (Text-Only Dashboard)
**Objective:** Build a fast, responsive, zero-image analytical interface in React + TailwindCSS.
**Tasks:**
1. **Left Column — Team & Dummy Configuration Panel:**
   - **Dummy Card:** Preset selector (Standard 600 DEF Dummy / Raid Boss Presets) + manual inputs for Afflatus, Reality DEF, Mental DEF, Crit Resist %, Crit DEF %, DMG Reduction %, and permanent debuff toggles.
   - **4 Character Slots:** Each slot allows selecting Character, Portrait (`P0`–`P5`), Insight (`I3 Lv60` default), Resonance Preset (`R10`/`R15`/Custom), Psychube (`Lv60`, `A1`–`A5`).
   - Display a compact stat table per slot showing **Pre-Battle Stats** vs. **Round 1 In-Battle Stats** side-by-side.
2. **Center Column — Round-by-Round Rotation Builder:**
   - `+ Add Round` button.
   - Inside each Round card: Display AP counter (`X / 4 AP`) and a live status bar of all 4 characters' `Moxie (0/5)`, `Eureka`, and active buffs at the start of that round.
   - Quick Action Bar: Select Character (`1–4`) + Action (`S1 1★/2★/3★`, `S2 1★/2★/3★`, `Ult`, `Merge +1 Moxie`, `Move 0 Moxie`, `Extra Action`).
   - Controls to move an action Up/Down, change star rank (`1★/2★/3★`), or delete it.
   - Inline warning badge if an action violates state rules (e.g., casting Ult with < 5 Moxie or exceeding 4 AP).
3. **Right Column — DPT Summary & Expandable Formula Log:**
   - **Top KPI Cards:**
     - Total Rotation Damage (`Expected`, `100% Crit`, `0% Crit`).
     - Average **DPT (Damage Per Turn)** across the rotation.
     - Damage Share % breakdown by character (text progress bar + exact numbers).
   - **Step-by-Step Combat Log:**
     - Each action row displays: `[R2 - Act 1] CharName casts SkillName (Rank) -> Expected: 42,150 | Crit: 48,900 | Non-Crit: 21,200`.
     - Clicking any row expands the **Exact Formula Inspector**: displays `InBattleATK`, `EffectiveDEF`, `BaseDMG`, `DMGMult%`, `MightMult%`, `CritMult%`, `AfflatusMult`, `SkillMultiplier%`, and the exact list of active Buffs/Debuffs applied to that hit.
4. **Import / Export & Persistence:**
   - Auto-save current Team & Rotation state to `localStorage`.
   - `Export JSON` / `Import JSON` buttons to save and share specific 4-man rotations.
**Gate 4:** `npm run build` succeeds with zero TypeScript errors and UI renders cleanly.

---

### PHASE 5: Character Expansion Workflow (Standard Operating Procedure)
Whenever the user asks to add a new Character or Psychube after Phase 4:
1. Run `npx tsx scripts/extract-game-data.ts --char "<CharacterNameOrID>"` to pull exact multipliers and stat curves from `raw_data/`.
2. Create `src/data/characters/<slug>.ts` implementing `CharacterBlueprint` (wiring any unique Pos/Neg Statuses, Follow-up triggers, or Excess Crit conversions into `buffManager` / `battleSimulator` hooks).
3. Register the character in `src/data/characters/index.ts`.
4. Create `tests/characters/<slug>.test.ts` verifying P0–P5 multipliers and unique mechanics.
5. Run `npm run test` and `npm run build` to confirm zero regressions.