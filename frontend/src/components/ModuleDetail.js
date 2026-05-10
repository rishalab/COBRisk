import React, { useState } from 'react';
import styles from './ModuleDetail.module.css';
import AISuggestions from './AISuggestions';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip
} from 'recharts';

const TIER_CFG = {
  HIGH:   { color: 'var(--risk-high)',  bg: 'var(--risk-high-bg)', label: '🔴 HIGH RISK'   },
  MEDIUM: { color: 'var(--risk-med)',   bg: 'var(--risk-med-bg)',  label: '🟡 MEDIUM RISK' },
  LOW:    { color: 'var(--risk-low)',   bg: 'var(--risk-low-bg)',  label: '🟢 LOW RISK'    },
};

/**
 * Five MRI dimensions with their nine constituent signals.
 * Source: COBRisk paper §3 — design and architecture.
 * Each dimension maps directly to measurable COBOL-specific signals.
 */
const METRIC_INFO = {
  coupling_density: {
    label:   'Coupling Density',
    icon:    '🔗',
    desc:    'Blast radius — how many programs depend on this one',
    signals: [
      { key: 'coupling_in',    label: 'Inbound CALLs (fan-in)' },
      { key: 'coupling_out',   label: 'Outbound CALLs / COPYs' },
      { key: 'file_ops',       label: 'File operation verbs (OPEN/READ/WRITE…)' },
      { key: 'shared_file_ops',label: 'Shared SELECT/FD files (cross-module)' },
    ],
    why: 'High inbound fan-in = blast radius. Shared files = hidden coupling invisible to generic analysers like SonarQube.',
  },
  documentation_deficit: {
    label:   'Documentation Deficit',
    icon:    '📝',
    desc:    'Translation feasibility — how hard is it to understand intent',
    signals: [
      { key: 'comment_lines', label: 'Comment lines' },
      { key: 'code_lines',    label: 'Code lines (denominator)' },
    ],
    why: 'Low comment ratio makes both manual and automated migration harder to validate.',
  },
  logic_volatility: {
    label:   'Logic Volatility',
    icon:    '⚡',
    desc:    'Structural blockers — spaghetti control flow resists structured targets',
    signals: [
      { key: 'goto_count',  label: 'GOTO statements' },
      { key: 'paragraphs',  label: 'Total paragraphs' },
    ],
    why: 'GOTO-heavy code cannot be mechanically transpiled — requires manual restructuring first.',
  },
  data_complexity: {
    label:   'Data Complexity',
    icon:    '🗃️',
    desc:    'Conversion overhead — COBOL data layouts with no clean modern equivalent',
    signals: [
      { key: 'redefines', label: 'REDEFINES clauses' },
      { key: 'comp3',     label: 'COMP-3 packed decimal fields' },
      { key: 'ebcdic',    label: 'EBCDIC-encoded fields' },
    ],
    why: 'REDEFINES, packed decimal, and EBCDIC all require specialised converters — no clean 1:1 mapping.',
  },
  dead_code_ratio: {
    label:   'Dead Code Ratio',
    icon:    '💀',
    desc:    'Effort inflation — unreachable code wastes migration effort if not pruned first',
    signals: [
      { key: 'dead_paragraphs', label: 'Unreachable paragraphs' },
    ],
    why: 'Migrating dead code is pure waste. Prune before migrating to reduce scope and risk.',
  },
};

/**
 * MRI Formula (COBRisk §3):
 * Weighted arithmetic mean of the five normalised dimension scores.
 * Weights reflect practitioner-derived importance hierarchy.
 * Formula choice (arithmetic vs geometric vs conjunctive) is acknowledged
 * as an open methodological question in the paper (§6).
 */
const MRI_WEIGHTS = {
  coupling_density:      0.30,  // Highest weight — blast radius is primary migration risk
  documentation_deficit: 0.20,
  logic_volatility:      0.20,
  data_complexity:       0.20,
  dead_code_ratio:       0.10,  // Lowest — prunable, not a migration blocker per se
};

/** Three-tier classification thresholds from the COBRisk paper. */
const TIER_THRESHOLDS = { LOW: 35, MEDIUM: 60 }; // < 35 LOW, 35–60 MEDIUM, > 60 HIGH

function GaugeBar({ value, color }) {
  return (
    <div className={styles.gaugeTrack}>
      <div
        className={styles.gaugeFill}
        style={{ width: `${value}%`, background: color }}
      />
      <span className={styles.gaugeVal}>{value}</span>
    </div>
  );
}

function scoreColor(v) {
  if (v >= TIER_THRESHOLDS.MEDIUM) return 'var(--risk-high)';
  if (v >= TIER_THRESHOLDS.LOW)    return 'var(--risk-med)';
  return 'var(--risk-low)';
}

/** Expandable per-dimension signal breakdown panel. */
function DimensionSignalBreakdown({ metricKey, info, metricValue, raw }) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(metricValue);

  return (
    <div className={styles.metricRow}>
      <div className={styles.metricHeader}>
        <span className={styles.metricIcon}>{info.icon}</span>
        <span className={styles.metricLabel}>{info.label}</span>
        <span className={styles.metricDesc}>{info.desc}</span>
        <button
          className={styles.signalToggle}
          onClick={() => setExpanded(e => !e)}
          title="Show constituent signals"
        >
          {expanded ? '▲ signals' : '▼ signals'}
        </button>
      </div>
      <GaugeBar value={metricValue} color={color} />

      {expanded && (
        <div className={styles.signalBreakdown}>
          <div className={styles.signalBreakdownInner}>
            <div className={styles.signalList}>
              {info.signals.map(sig => (
                <div key={sig.key} className={styles.signalRow}>
                  <span className={styles.signalLabel}>{sig.label}</span>
                  <span className={styles.signalVal}>
                    {raw[sig.key] !== undefined ? raw[sig.key] : '—'}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.signalWhy}>
              <span className={styles.signalWhyIcon}>ℹ</span>
              {info.why}
            </div>
            <div className={styles.signalWeight}>
              MRI weight: <strong>{(MRI_WEIGHTS[metricKey] * 100).toFixed(0)}%</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** MRI formula explainer tooltip / callout. */
function MRIFormulaCallout({ mri, metrics }) {
  const [show, setShow] = useState(false);

  const weightedParts = Object.entries(MRI_WEIGHTS).map(([key, w]) => ({
    label:  METRIC_INFO[key].label,
    score:  metrics[key],
    weight: w,
    contrib: Math.round(metrics[key] * w),
  }));

  return (
    <div className={styles.formulaCallout}>
      <button
        className={styles.formulaToggle}
        onClick={() => setShow(s => !s)}
      >
        ƒ How is MRI {mri} calculated? {show ? '▲' : '▼'}
      </button>

      {show && (
        <div className={styles.formulaBody}>
          <p className={styles.formulaTitle}>
            MRI = Weighted arithmetic mean of five dimension scores
          </p>
          <div className={styles.formulaTable}>
            <div className={styles.formulaRow + ' ' + styles.formulaHeader}>
              <span>Dimension</span>
              <span>Score</span>
              <span>Weight</span>
              <span>Contribution</span>
            </div>
            {weightedParts.map(p => (
              <div key={p.label} className={styles.formulaRow}>
                <span>{p.label}</span>
                <span>{p.score}</span>
                <span>{(p.weight * 100).toFixed(0)}%</span>
                <span>{p.contrib}</span>
              </div>
            ))}
            <div className={styles.formulaRow + ' ' + styles.formulaTotal}>
              <span>MRI Total</span>
              <span></span>
              <span>100%</span>
              <span>{mri}</span>
            </div>
          </div>
          <p className={styles.formulaNote}>
            ⚠ Formula note: The choice between weighted arithmetic mean, geometric mean, and
            conjunctive aggregation is an open methodological question acknowledged in the
            COBRisk paper §6. Weights are derived from practitioner heuristics in COBOL
            modernisation literature and will be empirically validated in the follow-on study.
          </p>
          <div className={styles.tierThresholds}>
            <span style={{ color: 'var(--risk-low)' }}>🟢 &lt;35 = LOW</span>
            <span style={{ color: 'var(--risk-med)' }}>🟡 35–60 = MEDIUM</span>
            <span style={{ color: 'var(--risk-high)' }}>🔴 &gt;60 = HIGH</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModuleDetail({ module: m, onClose, aiConfigured }) {
  const cfg = TIER_CFG[m.tier];

  const radarData = Object.entries(METRIC_INFO).map(([key, info]) => ({
    subject:  info.icon + ' ' + info.label.split(' ')[0],
    value:    m.metrics[key],
    fullMark: 100,
  }));

  const raw = m.metrics.raw;

  return (
    <div className={styles.panel}>
      {/* ── Header ── */}
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.filename}>{m.filename}</div>
          <span className={styles.tierBadge} style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
      </div>

      {/* ── MRI Score hero ── */}
      <div className={styles.mriHero} style={{ background: cfg.bg, borderColor: cfg.color }}>
        <div className={styles.mriCircle} style={{ borderColor: cfg.color }}>
          <span className={styles.mriNum} style={{ color: cfg.color }}>{m.mri}</span>
          <span className={styles.mriLabel}>MRI</span>
        </div>
        <div className={styles.mriInfo}>
          <p className={styles.recommendation}>{m.recommendation}</p>
          <div className={styles.quickStats}>
            <span>📄 {m.lines} lines</span>
            <span>🔧 {m.paragraphs.length} paragraphs</span>
            <span>📦 {m.divisions.length} divisions</span>
          </div>
        </div>
      </div>

      {/* ── MRI Formula Callout ── */}
      <MRIFormulaCallout mri={m.mri} metrics={m.metrics} />

      {/* ── Radar Chart ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Risk Profile — Five MRI Dimensions</h3>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            />
            <Radar
              name="Risk"
              dataKey="value"
              stroke={cfg.color}
              fill={cfg.color}
              fillOpacity={0.18}
              strokeWidth={2}
            />
            <Tooltip
              formatter={(v) => [`${v}/100`]}
              contentStyle={{
                background:   'var(--bg-card)',
                border:       '1px solid var(--border)',
                borderRadius: '8px',
                fontFamily:   'inherit',
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Five Metric Bars with signal breakdown ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Metric Breakdown
          <span className={styles.sectionNote}>Click ▼ signals to see constituent raw counts</span>
        </h3>
        {Object.entries(METRIC_INFO).map(([key, info]) => (
          <DimensionSignalBreakdown
            key={key}
            metricKey={key}
            info={info}
            metricValue={m.metrics[key]}
            raw={raw}
          />
        ))}
      </div>

      {/* ── Raw signal counts (nine COBRisk signals + shared file ops) ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Raw Signal Counts
          <span className={styles.sectionNote}>Nine COBRisk signals + cross-module file coupling</span>
        </h3>
        <div className={styles.rawGrid}>
          {[
            ['Inbound CALLs',    raw.coupling_in,          '🔗'],
            ['Outbound CALLs',   raw.coupling_out,         '🔗'],
            ['File Verb Ops',    raw.file_ops,             '🗄️'],
            ['Shared Files',     raw.shared_file_ops ?? 0, '🔀'],
            ['Comment Lines',    raw.comment_lines,        '📝'],
            ['Code Lines',       raw.code_lines,           '📄'],
            ['GOTO Statements',  raw.goto_count,           '⚡'],
            ['Total Paragraphs', raw.paragraphs,           '¶'],
            ['REDEFINES',        raw.redefines,            '🔁'],
            ['COMP-3 Fields',    raw.comp3,                '🔢'],
            ['EBCDIC Fields',    raw.ebcdic ?? 0,          '🔤'],
            ['Dead Paragraphs',  raw.dead_paragraphs,      '💀'],
          ].map(([label, val, icon]) => (
            <div key={label} className={styles.rawItem}>
              <span className={styles.rawIcon}>{icon}</span>
              <span className={styles.rawVal}>{val}</span>
              <span className={styles.rawLabel}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Divisions ── */}
      {m.divisions.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Divisions Found</h3>
          <div className={styles.divisionRow}>
            {m.divisions.map(d => (
              <span key={d} className={styles.divBadge}>{d}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Paragraphs ── */}
      {m.paragraphs.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Paragraphs ({m.paragraphs.length})</h3>
          <div className={styles.paraList}>
            {m.paragraphs.map(p => (
              <code key={p} className={styles.paraChip}>{p}</code>
            ))}
          </div>
        </div>
      )}

      {/* ── AI Suggestions (MEDIUM + HIGH only) ── */}
      {(m.tier === 'MEDIUM' || m.tier === 'HIGH') && (
        <div className={styles.section}>
          <AISuggestions module={m} aiConfigured={aiConfigured} />
        </div>
      )}
    </div>
  );
}
