import React, { useState } from 'react';
import styles from './MigrationPlan.module.css';
import AIBatchPanel from './AIBatchPanel';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

/**
 * Three-tier classification thresholds — COBRisk paper §3.
 * MRI < 35  → LOW    (migrate now)
 * MRI 35–60 → MEDIUM (refactor before migrating)
 * MRI > 60  → HIGH   (defer — wrap-and-modernise strategy)
 */
const TIER_CFG = {
  HIGH: {
    color: 'var(--risk-high)', bg: 'var(--risk-high-bg)',
    label: '🔴 HIGH',
    phase: 'Phase 3 — Prepare & Defer',
    weeks: '12–24 weeks',
    strategy: 'wrap-and-modernise',
  },
  MEDIUM: {
    color: 'var(--risk-med)', bg: 'var(--risk-med-bg)',
    label: '🟡 MEDIUM',
    phase: 'Phase 2 — Refactor & Migrate',
    weeks: '6–12 weeks',
    strategy: 'refactor-first',
  },
  LOW: {
    color: 'var(--risk-low)', bg: 'var(--risk-low-bg)',
    label: '🟢 LOW',
    phase: 'Phase 1 — Migrate Now',
    weeks: '1–4 weeks',
    strategy: 'direct-migration',
  },
};

/**
 * Phase descriptions — exactly as described in COBRisk paper.
 * LOW:    isolated, well-structured, low coupling → migrate first to build confidence.
 * MEDIUM: require documentation improvement and coupling reduction before safe migration.
 * HIGH:   do not migrate yet — require extensive decoupling, expert review, and either
 *         wrap-and-modernise or strangler fig pattern.
 */
const PHASE_DESC = {
  LOW:
    'These modules are isolated, well-structured, and have low coupling (MRI < 35). ' +
    'Begin migration here to build team confidence and establish the target-platform pipeline. ' +
    'They are good first candidates because changes will not ripple into other programs.',
  MEDIUM:
    'These modules (MRI 35–60) require documentation improvement, coupling reduction, and ' +
    'dead-code pruning before safe migration. Plan refactoring sprints first, re-score with ' +
    'COBRisk after each sprint, and migrate once MRI drops below 35.',
  HIGH:
    'Do NOT migrate these modules yet (MRI > 60). They require extensive decoupling, ' +
    'documentation, COMP-3/EBCDIC conversion planning, and expert domain review. ' +
    'Recommended strategy: wrap-and-modernise (anti-corruption layer) or strangler fig pattern. ' +
    'Assign a domain expert to each HIGH-risk module before touching it.',
};

/**
 * SonarQube baseline comparison — demonstrates which COBOL-specific signals
 * COBRisk catches that generic static analysis misses.
 * Source: COBRisk paper §5 evaluation design.
 */
const SONARQUBE_COMPARISON = [
  {
    signal:     'REDEFINES clauses',
    cobRisk:    true,
    sonar:      false,
    dimension:  'Data Complexity',
    importance: 'Overlapping memory layouts have no modern equivalent; require specialised converters.',
  },
  {
    signal:     'COMP-3 / packed decimal fields',
    cobRisk:    true,
    sonar:      false,
    dimension:  'Data Complexity',
    importance: 'BCD encoding is COBOL-specific; arithmetic behaviour differs from binary float.',
  },
  {
    signal:     'EBCDIC-encoded fields',
    cobRisk:    true,
    sonar:      false,
    dimension:  'Data Complexity',
    importance: 'Character set conversion errors are a leading cause of mainframe migration bugs.',
  },
  {
    signal:     'Inbound CALL coupling (fan-in)',
    cobRisk:    true,
    sonar:      false,
    dimension:  'Coupling Density',
    importance: 'Blast radius — how many programs break if this one changes.',
  },
  {
    signal:     'Dead paragraph detection',
    cobRisk:    true,
    sonar:      false,
    dimension:  'Dead Code Ratio',
    importance: 'COBOL dead paragraphs require paragraph-level reachability analysis, not just flow graphs.',
  },
  {
    signal:     'SELECT/FD shared file ops',
    cobRisk:    true,
    sonar:      false,
    dimension:  'Coupling Density',
    importance: 'Shared file coupling is invisible to generic analysers but critical for migration ordering.',
  },
  {
    signal:     'Cyclomatic complexity',
    cobRisk:    true,
    sonar:      true,
    dimension:  'Logic Volatility (partial)',
    importance: 'Both tools detect this, but COBRisk maps it to the GOTO + paragraph count dimension.',
  },
  {
    signal:     'Comment ratio',
    cobRisk:    true,
    sonar:      true,
    dimension:  'Documentation Deficit',
    importance: 'Both detect low comment density; COBRisk frames it as migration translation feasibility.',
  },
];

function PhaseCard({ tier, modules, onModuleClick }) {
  const cfg = TIER_CFG[tier];
  const [open, setOpen] = useState(tier === 'LOW');

  return (
    <div className={styles.phaseCard} style={{ borderColor: cfg.color }}>
      <button className={styles.phaseHeader} onClick={() => setOpen(o => !o)}>
        <div className={styles.phaseLeft}>
          <span className={styles.phaseBadge} style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
          <div>
            <div className={styles.phaseTitle}>{cfg.phase}</div>
            <div className={styles.phaseTime}>
              ⏱ Estimated: {cfg.weeks} · {modules.length} module{modules.length !== 1 ? 's' : ''}
              {' '}· Strategy: <em>{cfg.strategy}</em>
            </div>
          </div>
        </div>
        <span className={styles.phaseToggle} style={{ color: cfg.color }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className={styles.phaseBody}>
          <p className={styles.phaseDesc}>{PHASE_DESC[tier]}</p>

          {/* MRI threshold callout */}
          <div className={styles.thresholdCallout} style={{ borderColor: cfg.color, background: cfg.bg }}>
            <span className={styles.thresholdIcon}>
              {tier === 'LOW' ? '< 35 MRI' : tier === 'MEDIUM' ? '35–60 MRI' : '> 60 MRI'}
            </span>
            <span className={styles.thresholdLabel}>
              {tier === 'LOW'
                ? 'Isolated · low coupling · high readability'
                : tier === 'MEDIUM'
                ? 'Needs refactoring before migration'
                : 'Requires expert review + wrap strategy'}
            </span>
          </div>

          <div className={styles.moduleList}>
            {modules.length === 0 ? (
              <p className={styles.emptyMsg}>No modules in this tier.</p>
            ) : modules.map((m, i) => (
              <div
                key={m.filename}
                className={styles.moduleRow}
                onClick={() => onModuleClick && onModuleClick(m)}
                style={{ cursor: onModuleClick ? 'pointer' : 'default' }}
              >
                <span className={styles.moduleOrder} style={{ background: cfg.bg, color: cfg.color }}>
                  #{i + 1}
                </span>
                <div className={styles.moduleInfo}>
                  <span className={styles.moduleName}>{m.filename}</span>
                  <span className={styles.moduleMeta}>
                    {m.lines} lines · {m.paragraphs.length} paragraphs
                  </span>
                </div>
                <div className={styles.moduleMRI}>
                  <span className={styles.mriNum} style={{ color: cfg.color }}>{m.mri}</span>
                  <span className={styles.mriLabel}>MRI</span>
                </div>
                <div className={styles.moduleRec}>{m.recommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** SonarQube vs COBRisk comparison panel — paper §5 evaluation baseline. */
function SonarQubeComparison() {
  const [open, setOpen] = useState(false);

  const cobOnly  = SONARQUBE_COMPARISON.filter(r => r.cobRisk && !r.sonar);
  const bothDetect = SONARQUBE_COMPARISON.filter(r => r.cobRisk && r.sonar);

  return (
    <div className={styles.sonarCard}>
      <button className={styles.sonarToggle} onClick={() => setOpen(o => !o)}>
        <span className={styles.sonarIcon}>📊</span>
        <div>
          <span className={styles.sonarTitle}>COBRisk vs SonarQube — Baseline Comparison</span>
          <span className={styles.sonarSub}>
            {cobOnly.length} COBOL-specific signals that generic analysis misses
          </span>
        </div>
        <span className={styles.sonarChevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.sonarBody}>
          <p className={styles.sonarDesc}>
            SonarQube applies generic static analysis metrics (cyclomatic complexity, comment ratio,
            duplicate code). It has no awareness of COBOL-specific constructs. The signals below
            are the differentiating value of COBRisk — they catch migration risks that SonarQube
            will systematically miss on any COBOL codebase.
          </p>

          <div className={styles.sonarTable}>
            <div className={styles.sonarTableHeader}>
              <span>Signal / Construct</span>
              <span>COBRisk</span>
              <span>SonarQube</span>
              <span>MRI Dimension</span>
            </div>

            <div className={styles.sonarSection}>🎯 COBRisk-only signals (COBOL-specific)</div>
            {cobOnly.map(r => (
              <div key={r.signal} className={styles.sonarTableRow}>
                <div>
                  <div className={styles.sonarSignalName}>{r.signal}</div>
                  <div className={styles.sonarSignalNote}>{r.importance}</div>
                </div>
                <span className={styles.sonarYes}>✓</span>
                <span className={styles.sonarNo}>✗</span>
                <span className={styles.sonarDim}>{r.dimension}</span>
              </div>
            ))}

            <div className={styles.sonarSection}>🤝 Detected by both tools</div>
            {bothDetect.map(r => (
              <div key={r.signal} className={styles.sonarTableRow}>
                <div>
                  <div className={styles.sonarSignalName}>{r.signal}</div>
                  <div className={styles.sonarSignalNote}>{r.importance}</div>
                </div>
                <span className={styles.sonarYes}>✓</span>
                <span className={styles.sonarYes}>✓</span>
                <span className={styles.sonarDim}>{r.dimension}</span>
              </div>
            ))}
          </div>

          <p className={styles.sonarFootnote}>
            Source: COBRisk evaluation design (§5). The same codebase is analysed by both tools;
            disagreement cases (modules flagged HIGH by COBRisk but low-complexity by SonarQube)
            demonstrate the value of COBOL-specific signal extraction.
          </p>
        </div>
      )}
    </div>
  );
}

/** Pipeline positioning — COBMaker → COBook → COBRisk. */
function PipelineBanner() {
  return (
    <div className={styles.pipelineBanner}>
      <span className={styles.pipelineLabel}>RISHA Lab COBOL Portfolio Pipeline</span>
      <div className={styles.pipelineSteps}>
        {[
          { name: 'COBMaker', role: 'Training data generation', active: false },
          { name: 'COBook',   role: 'Program comprehension',    active: false },
          { name: 'COBRisk',  role: 'Migration risk sequencing', active: true },
        ].map((s, i, arr) => (
          <React.Fragment key={s.name}>
            <div className={`${styles.pipelineStep} ${s.active ? styles.pipelineStepActive : ''}`}>
              <span className={styles.pipelineStepName}>{s.name}</span>
              <span className={styles.pipelineStepRole}>{s.role}</span>
            </div>
            {i < arr.length - 1 && <span className={styles.pipelineArrow}>→</span>}
          </React.Fragment>
        ))}
      </div>
      <span className={styles.pipelineFootnote}>
        COBRisk sits at the sequencing stage — after comprehension, before migration execution.
      </span>
    </div>
  );
}

/** Export migration report as JSON (for Zenodo deposit / paper appendix). */
function exportReport(modules, summary) {
  const report = {
    tool:       'COBRisk v1.1',
    generated:  new Date().toISOString(),
    summary,
    mri_formula: {
      type:    'weighted_arithmetic_mean',
      weights: {
        coupling_density:      0.30,
        documentation_deficit: 0.20,
        logic_volatility:      0.20,
        data_complexity:       0.20,
        dead_code_ratio:       0.10,
      },
      thresholds: { LOW: 35, MEDIUM: 60 },
      note: 'Formula choice (arithmetic vs geometric vs conjunctive aggregation) is an open methodological question acknowledged in COBRisk §6.',
    },
    modules: modules.map(m => ({
      filename:       m.filename,
      mri:            m.mri,
      tier:           m.tier,
      lines:          m.lines,
      recommendation: m.recommendation,
      metrics:        m.metrics,
      paragraphs:     m.paragraphs,
      divisions:      m.divisions,
    })),
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `cobRisk_report_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MigrationPlan({ modules, summary, aiConfigured, onModuleSelect }) {
  const byTier = {
    LOW:    modules.filter(m => m.tier === 'LOW').sort((a, b) => a.mri - b.mri),
    MEDIUM: modules.filter(m => m.tier === 'MEDIUM').sort((a, b) => a.mri - b.mri),
    HIGH:   modules.filter(m => m.tier === 'HIGH').sort((a, b) => b.mri - a.mri),
  };

  // Sort ascending by MRI for the chart
  const chartData = [...modules]
    .sort((a, b) => a.mri - b.mri)
    .map(m => ({
      name: m.filename.replace(/\.(cob|cbl|cpy)$/i, ''),
      mri:  m.mri,
      tier: m.tier,
    }));

  const COLORS = { LOW: '#2d7a4f', MEDIUM: '#d4860a', HIGH: '#e8622a' };

  return (
    <div className={styles.wrap}>

      {/* ── Pipeline Positioning ── */}
      <PipelineBanner />

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Migration Roadmap</h2>
          <p className={styles.subtitle}>
            Modules ranked by Migration Risk Index — start Phase 1 and work upward.
            MRI thresholds: 🟢&nbsp;&lt;35&nbsp;LOW · 🟡&nbsp;35–60&nbsp;MEDIUM · 🔴&nbsp;&gt;60&nbsp;HIGH
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.headerStats}>
            <div className={styles.headerStat}>
              <span className={styles.headerStatVal} style={{ color: 'var(--risk-low)' }}>
                {byTier.LOW.length}
              </span>
              <span className={styles.headerStatLabel}>Ready now</span>
            </div>
            <div className={styles.headerStat}>
              <span className={styles.headerStatVal} style={{ color: 'var(--risk-med)' }}>
                {byTier.MEDIUM.length}
              </span>
              <span className={styles.headerStatLabel}>Needs prep</span>
            </div>
            <div className={styles.headerStat}>
              <span className={styles.headerStatVal} style={{ color: 'var(--risk-high)' }}>
                {byTier.HIGH.length}
              </span>
              <span className={styles.headerStatLabel}>Defer</span>
            </div>
          </div>
          <button
            className={styles.exportBtn}
            onClick={() => exportReport(modules, summary)}
            title="Export COBRisk JSON report (for Zenodo deposit / paper appendix)"
          >
            ⬇ Export Report
          </button>
        </div>
      </div>

      {/* ── MRI Bar Chart with threshold lines ── */}
      <div className={styles.chartCard}>
        <h3 className={styles.chartTitle}>MRI Scores Across All Modules</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 50, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}
              angle={-35}
              textAnchor="end"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              label={{ value: 'MRI', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--text-muted)' }}
            />
            <Tooltip
              formatter={(v, _name, props) => [`${v} MRI · ${props.payload.tier}`]}
              contentStyle={{
                background:   'var(--bg-card)',
                border:       '1px solid var(--border)',
                borderRadius: '10px',
                fontFamily:   'inherit',
              }}
            />
            {/* Threshold reference lines from the paper */}
            <ReferenceLine y={35} stroke="#2d7a4f" strokeDasharray="4 2" label={{ value: 'LOW/MED 35', position: 'right', fontSize: 10, fill: '#2d7a4f' }} />
            <ReferenceLine y={60} stroke="#e8622a" strokeDasharray="4 2" label={{ value: 'MED/HIGH 60', position: 'right', fontSize: 10, fill: '#e8622a' }} />
            <Bar dataKey="mri" radius={[6, 6, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={COLORS[d.tier]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className={styles.chartLegend}>
          <span style={{ color: '#2d7a4f' }}>🟢 &lt;35 LOW — migrate now</span>
          <span style={{ color: '#d4860a' }}>🟡 35–60 MEDIUM — refactor first</span>
          <span style={{ color: '#e8622a' }}>🔴 &gt;60 HIGH — defer / wrap-and-modernise</span>
        </div>
      </div>

      {/* ── Phase Cards ── */}
      <div className={styles.phases}>
        {['LOW', 'MEDIUM', 'HIGH'].map(tier => (
          <PhaseCard
            key={tier}
            tier={tier}
            modules={byTier[tier]}
            onModuleClick={onModuleSelect}
          />
        ))}
      </div>

      {/* ── SonarQube Baseline Comparison ── */}
      <SonarQubeComparison />

      {/* ── Pre-Migration Checklist ── */}
      <div className={styles.checklistCard}>
        <h3 className={styles.checklistTitle}>📋 Pre-Migration Checklist</h3>
        <div className={styles.checklistGrid}>
          {[
            { icon: '📝', item: 'Document all WORKING-STORAGE variables with business-domain meaning' },
            { icon: '🧪', item: 'Create baseline regression tests for all PROCEDURE DIVISION paragraphs' },
            { icon: '🔗', item: 'Identify and reduce inbound CALL coupling for MEDIUM + HIGH modules' },
            { icon: '🔢', item: 'Handle COMP-3 / packed decimal fields with specialised decimal converters' },
            { icon: '🔤', item: 'Audit EBCDIC-encoded fields and plan character-set conversion strategy' },
            { icon: '🔀', item: 'Map all REDEFINES clauses to target-language union/struct equivalents' },
            { icon: '👥', item: 'Assign domain expert to review each HIGH-risk module before touching it' },
            { icon: '🔄', item: 'Set up behavioural equivalence test harness before migrating any module' },
            { icon: '📊', item: 'Re-run COBRisk after each refactoring sprint — track MRI score reduction' },
            { icon: '🚦', item: 'Use CI/CD pipeline to validate migrated logic against original COBOL output' },
          ].map(c => (
            <label key={c.item} className={styles.checkItem}>
              <input type="checkbox" className={styles.checkBox} />
              <span className={styles.checkIcon}>{c.icon}</span>
              <span className={styles.checkText}>{c.item}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── AI Batch Suggestions for MEDIUM + HIGH ── */}
      <AIBatchPanel modules={modules} aiConfigured={aiConfigured} />
    </div>
  );
}
