import React, { useState, useMemo } from 'react';
import styles from './ModuleTable.module.css';

const TIER_CFG = {
  HIGH:   { color: 'var(--risk-high)',  bg: 'var(--risk-high-bg)', label: '🔴 HIGH'   },
  MEDIUM: { color: 'var(--risk-med)',   bg: 'var(--risk-med-bg)',  label: '🟡 MEDIUM' },
  LOW:    { color: 'var(--risk-low)',   bg: 'var(--risk-low-bg)',  label: '🟢 LOW'    },
};

function MRIBar({ value }) {
  const color = value >= 60 ? 'var(--risk-high)' : value >= 35 ? 'var(--risk-med)' : 'var(--risk-low)';
  return (
    <div className={styles.mriBarWrap}>
      <div className={styles.mriBarTrack}>
        <div className={styles.mriBarFill} style={{ width: `${value}%`, background: color }} />
      </div>
      <span className={styles.mriBarVal} style={{ color }}>{value}</span>
    </div>
  );
}

export default function ModuleTable({ modules, onSelect, compact }) {
  const [sortKey, setSortKey] = useState('mri');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('ALL');

  const sorted = useMemo(() => {
    let list = filter === 'ALL' ? modules : modules.filter(m => m.tier === filter);
    return [...list].sort((a, b) => {
      let av = sortKey === 'mri' ? a.mri
             : sortKey === 'lines' ? a.lines
             : sortKey === 'coupling' ? a.metrics.coupling_density
             : 0;
      let bv = sortKey === 'mri' ? b.mri
             : sortKey === 'lines' ? b.lines
             : sortKey === 'coupling' ? b.metrics.coupling_density
             : 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [modules, sortKey, sortDir, filter]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }) => sortKey === k
    ? <span className={styles.sortActive}>{sortDir === 'desc' ? '↓' : '↑'}</span>
    : <span className={styles.sortInactive}>↕</span>;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>
          {compact ? 'Top Risk Modules' : 'All Modules'} <span className={styles.count}>{sorted.length}</span>
        </h2>
        <div className={styles.filters}>
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(t => (
            <button
              key={t}
              className={`${styles.filterBtn} ${filter === t ? styles.filterActive : ''}`}
              style={filter === t && t !== 'ALL' ? {
                background: TIER_CFG[t]?.bg, color: TIER_CFG[t]?.color,
                borderColor: TIER_CFG[t]?.color
              } : {}}
              onClick={() => setFilter(t)}
            >
              {t === 'ALL' ? '🔍 All' : TIER_CFG[t].label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Module</th>
              <th className={styles.sortTh} onClick={() => toggleSort('mri')}>
                MRI Score <SortIcon k="mri" />
              </th>
              <th>Risk Tier</th>
              <th className={styles.sortTh} onClick={() => toggleSort('coupling')}>
                Coupling <SortIcon k="coupling" />
              </th>
              <th>Doc Deficit</th>
              <th>Data Complexity</th>
              <th className={styles.sortTh} onClick={() => toggleSort('lines')}>
                Lines <SortIcon k="lines" />
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(compact ? sorted.slice(0, 8) : sorted).map(m => {
              const cfg = TIER_CFG[m.tier];
              return (
                <tr key={m.filename} className={styles.row} onClick={() => onSelect(m)}>
                  <td>
                    <span className={styles.modName}>{m.filename}</span>
                    <span className={styles.modLines}>{m.lines} lines</span>
                  </td>
                  <td><MRIBar value={m.mri} /></td>
                  <td>
                    <span
                      className={styles.tierBadge}
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </td>
                  <td>
                    <span className={styles.metricVal}>{m.metrics.coupling_density}</span>
                  </td>
                  <td>
                    <span className={styles.metricVal}>{m.metrics.documentation_deficit}</span>
                  </td>
                  <td>
                    <span className={styles.metricVal}>{m.metrics.data_complexity}</span>
                  </td>
                  <td>
                    <span className={styles.lineCount}>{m.lines.toLocaleString()}</span>
                  </td>
                  <td>
                    <button className={styles.detailBtn}>View →</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
