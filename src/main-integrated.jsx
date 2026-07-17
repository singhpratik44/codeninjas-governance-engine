// ============================================================================
// INTEGRATED ENTRY POINT — Code Ninjas Franchise Governance System
//
// Combines all components:
// 1. Original Engine.tsx (legacy tabs: Command Table, Six Lens, Operations, etc.)
// 2. QuantumPMRefactored.tsx (new five-pillar approval engine)
// 3. governance-integration.ts (FranchiseGovernanceService)
//
// Five Pillars (Design Principles):
// 1. Holographic Principle → Boundary Observables
// 2. Black-Hole Thermodynamics → Information Release Curves
// 3. Quantum Geometry → Network Topology
// 4. Light Angles → Alignment Heuristic
// 5. Consciousness & IIT → Integration Metrics (Φ)
// ============================================================================

import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

// Import both engines
import EngineInner from './Engine'; // Original franchise engine
import { QuantumPMRefactored } from './QuantumPMRefactored'; // New governance engine

const INK = "#111";
const MUT = "#666";
const RULE = "#ccc";
const BG = "#fdfdfb";
const GRN = "#2f7a3f";
const VIO = "#7a6bd8";

/**
 * INTEGRATED APP
 *
 * Provides two parallel systems:
 * - LEFT SIDEBAR: Tab selector (original tabs + new Quantum PM tab)
 * - MAIN CONTENT: Whichever view is selected
 *
 * The Quantum PM tab is the new "source of truth" for approvals.
 * All other tabs cascade from decisions made in Quantum PM.
 */
function IntegratedApp() {
  const [selectedTab, setSelectedTab] = useState('quantum-pm');

  const tabs = [
    {
      id: 'quantum-pm',
      label: 'Quantum PM',
      description: 'Approval decisions via five pillars',
      icon: '◆',
      category: 'Governance',
    },
    {
      id: 'act',
      label: 'Action Queue',
      description: 'Decisions ready to send',
      icon: '→',
      category: 'Original Engine',
    },
    {
      id: 'rail',
      label: 'Decision Rail',
      description: 'Historical decision audit trail',
      icon: '≡',
      category: 'Original Engine',
    },
    {
      id: 'ops',
      label: 'Operations Board',
      description: 'Center workflows & dynamics',
      icon: '⚙',
      category: 'Original Engine',
    },
    {
      id: 'table',
      label: 'Command Table',
      description: 'Full network map & details',
      icon: '⊞',
      category: 'Original Engine',
    },
    {
      id: 'six-lens',
      label: 'Six Lens',
      description: 'Multi-dimensional analysis',
      icon: '◐',
      category: 'Original Engine',
    },
    {
      id: 'system',
      label: 'System Alignment',
      description: 'Cross-tab consistency check',
      icon: '↔',
      category: 'Original Engine',
    },
    {
      id: 'optim',
      label: 'Optimization Layer',
      description: 'Single optimizer, five roles',
      icon: '⊕',
      category: 'Original Engine',
    },
    {
      id: 'signals',
      label: 'Network Signals',
      description: 'Live alerts from current state',
      icon: '⚡',
      category: 'Original Engine',
    },
  ];

  const categories = [...new Set(tabs.map(t => t.category))];
  const groupedTabs = Object.fromEntries(
    categories.map(cat => [cat, tabs.filter(t => t.category === cat)])
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: BG }}>
      {/* LEFT SIDEBAR: TAB SELECTOR */}
      <div
        style={{
          width: 280,
          background: '#fff',
          borderRight: `1px solid ${RULE}`,
          overflowY: 'auto',
          padding: 16,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: MUT,
              marginBottom: 12,
            }}
          >
            Code Ninjas Governance
          </div>
          <div style={{ fontSize: 10, color: MUT, lineHeight: 1.6 }}>
            Integrated franchise approval & operations system. Navigate tabs to explore different views.
          </div>
        </div>

        {Object.entries(groupedTabs).map(([category, categoryTabs]) => (
          <div key={category} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: category === 'Governance' ? GRN : MUT,
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: `1px solid ${RULE}`,
              }}
            >
              {category}
            </div>
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  marginBottom: 6,
                  fontSize: 11,
                  fontWeight: selectedTab === tab.id ? 700 : 400,
                  background: selectedTab === tab.id ? '#f0f0f0' : 'transparent',
                  color: selectedTab === tab.id ? INK : MUT,
                  border: `1px solid ${selectedTab === tab.id ? RULE : 'transparent'}`,
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 12, marginBottom: 2 }}>
                  {tab.icon} {tab.label}
                </div>
                <div style={{ fontSize: 9, color: MUT, fontWeight: 400 }}>
                  {tab.description}
                </div>
              </button>
            ))}
          </div>
        ))}

        {/* About Section */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: `1px solid ${RULE}`,
            fontSize: 9,
            color: MUT,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>About This System</div>
          <p>
            The <strong>Quantum PM</strong> tab is the new approval engine, powered by five
            physics-grounded design pillars. All other tabs cascade from decisions made here.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Design Principles:</strong>
          </p>
          <ol style={{ margin: '4px 0 0 16px', paddingLeft: 0 }}>
            <li>Holographic Boundary</li>
            <li>Information Release Curves</li>
            <li>Network Topology</li>
            <li>Alignment Heuristic</li>
            <li>Integration Metrics (Φ)</li>
          </ol>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedTab === 'quantum-pm' && <QuantumPMRefactored />}

        {/* Original Engine tabs */}
        {(selectedTab === 'act' ||
          selectedTab === 'rail' ||
          selectedTab === 'ops' ||
          selectedTab === 'table' ||
          selectedTab === 'six-lens' ||
          selectedTab === 'system' ||
          selectedTab === 'optim' ||
          selectedTab === 'signals') && <EngineInner initialTab={selectedTab} />}
      </div>
    </div>
  );
}

// Mount to DOM
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<IntegratedApp />);
