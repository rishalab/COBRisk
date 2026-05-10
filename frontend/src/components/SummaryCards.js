import React from 'react';
import styles from './SummaryCards.module.css';
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts';

const RISK_CONFIG = {
  HIGH:   { color: 'var(--risk-high)', bg: 'var(--risk-high-bg)', emoji: '🔴' },
  MEDIUM: { color: 'var(--risk-med)',  bg: 'var(--risk-med-bg)',  emoji: '🟡' },
  LOW:    { color: 'var(--risk-low)',  bg: 'var(--risk-low-bg)',  emoji: '🟢' },
};

function MiniDonut({ high, medium, low }) {
  const total = high + medium + low || 1;
  const data = [
    { name: 'Low',    value: low,    fill: 'var(--risk-low)' },
    { name: 'Medium', value: medium, fill: 'var(--risk-med)' },
    { name: 'High',   value: high,   fill: 'var(--risk-high)' },
  ];
  return (
    <ResponsiveContainer width={140} height={140}>
      <RadialBarChart innerRadius={35} outerRadius={65} data={data} startAngle={90} endAngle={-270}>
        <RadialBar dataKey="value" cornerRadius={4} />
        <Tooltip formatter={(v) => [`${v} modules`]} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

export default function SummaryCards({ summary }) {
  const { total_modules, high_risk, medium_risk, low_risk, average_mri, total_lines } = summary;

  return (
    <div className={styles.grid}>
      {/* Big stat cards */}
      {[
        { label: 'Total Modules', value: total_modules, sub: 'COBOL files analyzed', color: 'var(--teal)', bg: 'var(--teal-pale)' },
        { label: 'Total Lines', value: total_lines.toLocaleString(), sub: 'Lines of code scanned', color: '#8b5cf6', bg: '#f3eeff' },
        { label: 'Average MRI', value: average_mri, sub: 'Migration Risk Index', color: 'var(--coral)', bg: 'var(--coral-pale)' },
        { label: 'Safe to Migrate', value: low_risk, sub: 'Low-risk modules', color: 'var(--green)', bg: 'var(--green-pale)' },
      ].map(c => (
        <div key={c.label} className={styles.statCard} style={{ '--card-color': c.color, '--card-bg': c.bg }}>
          <div className={styles.statBg} />
          <div className={styles.statValue}>{c.value}</div>
          <div className={styles.statLabel}>{c.label}</div>
          <div className={styles.statSub}>{c.sub}</div>
        </div>
      ))}

      {/* Risk distribution card */}
      <div className={`${styles.statCard} ${styles.donutCard}`}>
        <h3 className={styles.donutTitle}>Risk Distribution</h3>
        <div className={styles.donutRow}>
          <MiniDonut high={high_risk} medium={medium_risk} low={low_risk} />
          <div className={styles.donutLegend}>
            {[
              { tier: 'HIGH',   count: high_risk   },
              { tier: 'MEDIUM', count: medium_risk  },
              { tier: 'LOW',    count: low_risk    },
            ].map(({ tier, count }) => (
              <div key={tier} className={styles.legendRow}>
                <span className={styles.legendDot} style={{ background: RISK_CONFIG[tier].color }} />
                <span className={styles.legendTier}>{tier}</span>
                <span className={styles.legendCount}>{count}</span>
                <span className={styles.legendPct}>
                  ({total_modules ? Math.round((count / total_modules) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Migration readiness */}
      <div className={`${styles.statCard} ${styles.readinessCard}`}>
        <h3 className={styles.donutTitle}>Migration Readiness</h3>
        {['HIGH', 'MEDIUM', 'LOW'].map(tier => {
          const count = tier === 'HIGH' ? high_risk : tier === 'MEDIUM' ? medium_risk : low_risk;
          const pct = total_modules ? (count / total_modules) * 100 : 0;
          const cfg = RISK_CONFIG[tier];
          return (
            <div key={tier} className={styles.readinessRow}>
              <span className={styles.readinessTier}>{cfg.emoji} {tier}</span>
              <div className={styles.readinessBar}>
                <div
                  className={styles.readinessFill}
                  style={{ width: `${pct}%`, background: cfg.color }}
                />
              </div>
              <span className={styles.readinessPct}>{count}</span>
            </div>
          );
        })}
        <p className={styles.readinessNote}>
          {low_risk === 0
            ? '⚠ No modules are safe to migrate immediately.'
            : `✅ ${low_risk} module${low_risk > 1 ? 's' : ''} ready for immediate migration.`}
        </p>
      </div>
    </div>
  );
}
