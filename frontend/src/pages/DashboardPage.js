import React, { useState } from 'react';
import styles from './DashboardPage.module.css';
import SummaryCards from '../components/SummaryCards';
import ModuleTable from '../components/ModuleTable';
import ModuleDetail from '../components/ModuleDetail';
import DependencyGraph from '../components/DependencyGraph';
import MigrationPlan from '../components/MigrationPlan';

const TABS = [
  { id: 'overview', label: '📊 Overview'         },
  { id: 'modules',  label: '📋 Module Scores'    },
  { id: 'graph',    label: '🕸️ Dependency Graph' },
  { id: 'plan',     label: '🗺️ Migration Plan'   },
];

export default function DashboardPage({ data, onReset }) {
  const [tab, setTab]                     = useState('overview');
  const [selectedModule, setSelectedModule] = useState(null);

  const { modules, summary, dependency_graph } = data;
  const aiConfigured = data.ai_configured === true;

  /**
   * Navigate to module detail from any source:
   * - ModuleTable row click
   * - DependencyGraph node click
   * - MigrationPlan phase card row click  (new)
   */
  const handleModuleSelect = (mod) => {
    setSelectedModule(mod);
    setTab('modules');
  };

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⬡</span>
            <span className={styles.logoText}>CO<span>Risk</span></span>
          </div>
          <span className={styles.headerSub}>Analysis Complete</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.mriPill}>
            <span className={styles.mriLabel}>Avg MRI</span>
            <span className={styles.mriValue}>{summary.average_mri}</span>
          </div>
          <div className={aiConfigured ? styles.aiBadgeOn : styles.aiBadgeOff}>
            {aiConfigured ? '🤖 AI Ready' : '🤖 AI Off'}
          </div>
          <button className={styles.btnReset} onClick={onReset}>← New Analysis</button>
        </div>
      </header>

      {/* ── Tab Nav ── */}
      <nav className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className={styles.main}>
        {tab === 'overview' && (
          <>
            <SummaryCards summary={summary} />
            <div className={styles.overviewBottom}>
              <ModuleTable
                modules={modules}
                onSelect={m => { setSelectedModule(m); setTab('modules'); }}
                compact
              />
            </div>
          </>
        )}

        {tab === 'modules' && (
          <div className={styles.modulesLayout}>
            <ModuleTable modules={modules} onSelect={setSelectedModule} />
            {selectedModule && (
              <ModuleDetail
                module={selectedModule}
                onClose={() => setSelectedModule(null)}
                aiConfigured={aiConfigured}
              />
            )}
          </div>
        )}

        {tab === 'graph' && (
          <DependencyGraph
            graph={dependency_graph}
            onSelect={m => {
              const full = modules.find(x => x.filename === m.id);
              if (full) handleModuleSelect(full);
            }}
          />
        )}

        {tab === 'plan' && (
          <MigrationPlan
            modules={modules}
            summary={summary}
            aiConfigured={aiConfigured}
            onModuleSelect={handleModuleSelect}   // ← new: phase card rows navigate to detail
          />
        )}
      </main>
    </div>
  );
}
