# Entanglement Registry

Every symbol below is read or called from more than one tab / call site in `src/Engine.tsx`. Per `QUANTUM_METHODOLOGY.md`: **touching the definition of a listed symbol requires re-verifying every listed call site**, not just the one you meant to change. Update the "last verified" entry in `verification-ledger.md` in the same commit as any edit here.

## Historically fragile (already bitten us once — see CLAUDE.md)

| Symbol | Location | Call sites |
|---|---|---|
| `computeCentersForPosture` / `computeOverrideView` | `src/Engine.tsx:947,967` | main `centers` useMemo (3069) + every governed-tab override: exec, network, financials, risk, team |
| Recommendation diffing across two `runAllAgents()` outputs | `QuantumPMView` (proposalFlips) | must key on `agent+scope+targetIds.join(",")`, never `.id` — ids are minted per-call from a module-level counter |
| `r.targetIds.includes(c.name)` membership check | Risk Register | `targetIds` shape differs by agent: Growth `[leadId,region,anchorName]`, Unit Health/Retention `[centerName]`, Network Propagation `[source,target]` |

## Cross-tab shared state (read via closure by >3 tab blocks)

| Symbol | Approx. refs | Read by |
|---|---|---|
| `centers` | 131 | nearly every tab |
| `ledger` | 57 | audit, record, most action-logging tabs |
| `opt` | 54 | quantum, board, network, exec, team, financials — holds the Quantum-PM posture/override machinery |
| `railData` | 49 | rail, board, alignment, dynamics, quantum, exec, network, financials, team |
| `states` | 47 | most tabs |
| `LEADS` | 39 | leads, deals, expansion, growth, whitespace |
| `logL` | 31 | shared logging callback across nearly every action-taking tab |
| `adj` / `cap` | 21 / 22 | override write path (growth, team, financials) |
| `decisions` / `dyn` | 25 / 20 | board, rail, alignment, dynamics |
| `leadStage` / `dealAg` / `reso` | 15 / 13 / 13 | leads, deals, expansion |
| `jumpTo` | 13 | cross-tab navigation |

## Pure helpers called from ≥2 tabs

| Symbol | Location | Known callers |
|---|---|---|
| `forecast` | `src/Engine.tsx:821` | franchise, exec, team, network, growth, financials, whitespace |
| `engageOf` | `789` | team, network, franchise, financials, batch, cohort |
| `tierOf` | `798` | network, team, exec, franchise, financials |
| `conditionOf` | `1498` | lenses, alignment, reports, onboarding |
| `royaltyOf` | `1453` | lens/financial, financials, sensitivity, growthfin |
| `supportPathsOf` | `1767` | OperationsDynamicsTab, batch |
| `networkSupportIndexOf` | `1032` | lens, OperationsDynamicsTab |
| `qAmp` / `qResolve` / `qCoherence` / `qStateAmp` | `889-898` | franchise map, network, team, quantum-adjacent views |
| `qTau` | `903` | lenses, team, network |
| `qGate` / `qGovernors` | `982,995` | buildRecommendation, checkContract, LensSystem, QuantumPMView, team, network |
| `decisionLedgerExport` | `538` | board, audit, reports |
| `buildSummaryText` | `666` | franchise, reports |
| `myStudioPayloadOf` / `quickBooksPayloadOf` | `1460,1480` | financials, reports |
| `franchiseeDeltaOf` / `financialRange` / `rampMilestones` | `514,493,507` | franchise, financials, onboarding |
| `runAllAgents` | `1343` | main `railData` memo (3097) + independently re-invoked via `computeOverrideView` under quantum/exec/team/network/financials overrides — intentional (each override posture needs its own railData), not a duplication bug |

## Known findings, not yet actioned (flagged, awaiting explicit decision)

- `OperationsTab` (in the FB_BOUNDARY block) is defined but never wired into any tab switch — dead code. Not deleted pending explicit confirmation of whether the second `FB_BOUNDARY` dataset is reserved for future use.
