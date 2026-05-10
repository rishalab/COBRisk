import React, { useState } from 'react';
import axios from 'axios';
import styles from './AIBatchPanel.module.css';

const PRIORITY_CFG = {
  IMMEDIATE:   { color: '#e8622a', bg: '#fde8de', icon: '🔥' },
  'SHORT-TERM':{ color: '#d4860a', bg: '#fdf1d6', icon: '⚡' },
  'LONG-TERM': { color: '#2d7a4f', bg: '#d6f0e2', icon: '🗓️' },
};

const ERROR_HELP = {
  401: 'Invalid API key — update GROQ_API_KEY in backend/.env',
  403: 'Access denied — check your Groq account at console.groq.com',
  404: 'Model not found — set GROQ_MODEL=llama-3.1-8b-instant in backend/.env',
  429: 'Rate limit hit — wait a few seconds, then regenerate',
};

function ModuleSuggestionCard({ filename, tier, mri, data }) {
  const [open, setOpen] = useState(false);
  const tierColor = tier === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-med)';
  const tierBg    = tier === 'HIGH' ? 'var(--risk-high-bg)' : 'var(--risk-med-bg)';

  // Error state — data unavailable
  if (!data?.available) {
    const hint = data?.error_code ? ERROR_HELP[data.error_code] : null;
    return (
      <div className={styles.moduleCard} style={{ borderLeftColor: 'var(--risk-med)' }}>
        <div className={styles.moduleCardHeader}>
          <span className={styles.moduleName}>{filename}</span>
          <span className={styles.tierPill} style={{ background: tierBg, color: tierColor }}>
            {tier} · MRI {mri}
          </span>
          <span className={styles.errorTag}>⚠ {data?.reason || 'Unavailable'}</span>
        </div>
        {hint && <p className={styles.errorHint}>{hint}</p>}
      </div>
    );
  }

  return (
    <div className={styles.moduleCard} style={{ borderLeftColor: tierColor }}>
      <button className={styles.moduleCardHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.moduleName}>{filename}</span>
        <span className={styles.tierPill} style={{ background: tierBg, color: tierColor }}>
          {tier} · MRI {mri}
        </span>
        <span className={styles.toggleIcon}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Preview when collapsed */}
      {!open && data.summary && (
        <p className={styles.cardPreview}>{data.summary}</p>
      )}

      {/* Full card body when expanded */}
      {open && (
        <div className={styles.cardBody}>
          {/* Summary */}
          <div className={styles.summaryBox}>
            <p>{data.summary}</p>
          </div>

          {/* Issues + Actions — two-column */}
          <div className={styles.twoCol}>
            {/* Top Issues */}
            {data.top_issues?.length > 0 && (
              <div>
                <div className={styles.miniLabel}>🚨 Top Issues</div>
                {data.top_issues.map((issue, i) => (
                  <div key={i} className={styles.miniIssue}>
                    <span className={styles.miniNum}>{i + 1}</span>
                    <div>
                      <div className={styles.miniTitle}>{issue.issue}</div>
                      <div className={styles.miniDetail}>{issue.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Plan */}
            {data.action_plan?.length > 0 && (
              <div>
                <div className={styles.miniLabel}>📋 Action Plan</div>
                {data.action_plan.map((a, i) => {
                  const cfg = PRIORITY_CFG[a.priority] || PRIORITY_CFG['LONG-TERM'];
                  return (
                    <div key={i} className={styles.miniAction}>
                      <span
                        className={styles.miniPriority}
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.icon} {a.priority}
                      </span>
                      <div>
                        <div className={styles.miniActionText}>{a.action}</div>
                        <div className={styles.miniImpact}>→ {a.impact}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Migration strategy */}
          {data.migration_strategy && (
            <div className={styles.miniStrategy}>
              <div className={styles.miniLabel}>🗺️ Migration Strategy</div>
              <p className={styles.miniStrategyText}>{data.migration_strategy}</p>
            </div>
          )}

          {/* Quick wins + effort */}
          <div className={styles.bottomMini}>
            {data.quick_wins?.length > 0 && (
              <div className={styles.qwBox}>
                <div className={styles.miniLabel}>⚡ Quick Wins</div>
                <ul className={styles.qwList}>
                  {data.quick_wins.map((qw, i) => (
                    <li key={i}>
                      <span className={styles.qwCheck}>✓</span>{qw}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.estimated_effort && (
              <div className={styles.effortBox}>
                <div className={styles.miniLabel}>⏱ Effort</div>
                <div className={styles.effortVal}>{data.estimated_effort}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIBatchPanel({ modules, aiConfigured }) {
  const [state, setState]       = useState('idle');
  const [results, setResults]   = useState(null);
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const riskyModules = modules.filter(m => m.tier === 'MEDIUM' || m.tier === 'HIGH');

  const handleGenerate = async () => {
    setState('loading');
    setErrorMsg('');
    setProgress(
      `Analyzing ${riskyModules.length} module${riskyModules.length !== 1 ? 's' : ''} with Groq LLM…`
    );
    try {
      const res = await axios.post('https://cobrisk.onrender.com/api/ai-suggest-all', { modules });
      setResults(res.data.results);
      setState('done');
    } catch (e) {
      const msg = e.response?.data?.error || 'Network error — is the backend running on port 5000?';
      setErrorMsg(msg);
      setState('error');
    }
  };

  if (riskyModules.length === 0) {
    return (
      <div className={styles.emptyCard}>
        <span className={styles.emptyIcon}>🎉</span>
        <h3 className={styles.emptyTitle}>No risky modules!</h3>
        <p className={styles.emptySub}>
          All modules are LOW risk (MRI &lt; 35) — safe to migrate directly.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Panel header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🤖</span>
          <div>
            <h3 className={styles.headerTitle}>AI Suggestions — All MEDIUM + HIGH Modules</h3>
            <p className={styles.headerSub}>
              {riskyModules.length} module{riskyModules.length !== 1 ? 's' : ''} need attention ·
              Powered by Groq LLM · COBRisk five-dimension analysis
            </p>
          </div>
        </div>
        {aiConfigured
          ? <span className={styles.readyBadge}>● AI Ready</span>
          : <span className={styles.notReadyBadge}>○ Key needed</span>
        }
      </div>

      {/* API key warning */}
      {!aiConfigured && (
        <div className={styles.keyNeeded}>
          <span>🔑</span>
          <div>
            <strong>Groq API key not configured.</strong> Add it to <code>backend/.env</code> →{' '}
            <a href="https://console.groq.com/" target="_blank" rel="noreferrer">Get free key</a>
          </div>
        </div>
      )}

      {/* Idle — show module list + generate button */}
      {state === 'idle' && (
        <div className={styles.idleBody}>
          <div className={styles.modulePreview}>
            {riskyModules.map(m => (
              <div key={m.filename} className={styles.previewRow}>
                <span className={styles.previewFile}>{m.filename}</span>
                <span
                  className={styles.previewTier}
                  style={{
                    color:      m.tier === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-med)',
                    background: m.tier === 'HIGH' ? 'var(--risk-high-bg)' : 'var(--risk-med-bg)',
                  }}
                >
                  {m.tier} · MRI {m.mri}
                </span>
              </div>
            ))}
          </div>
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={!aiConfigured}
          >
            {aiConfigured
              ? `✨ Generate AI Suggestions for All ${riskyModules.length} Modules`
              : '🔒 Configure AI First'}
          </button>
          <p className={styles.idleNote}>
            Each module gets a tailored analysis based on its five MRI dimension scores
            and nine raw signal counts.
          </p>
        </div>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <div className={styles.loadingBody}>
          <div className={styles.loadingRing} />
          <p className={styles.loadingText}>{progress}</p>
          <p className={styles.loadingNote}>
            This may take 10–30 seconds for multiple modules — each gets a full analysis.
          </p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className={styles.errorBody}>
          <p>⚠ Failed to generate suggestions: <em>{errorMsg}</em></p>
          <button className={styles.retryBtn} onClick={handleGenerate}>↻ Retry</button>
        </div>
      )}

      {/* Results */}
      {state === 'done' && results && (
        <div className={styles.resultsBody}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsBadge}>
              ✅ {Object.keys(results).length} of {riskyModules.length} modules analyzed
            </span>
            <button className={styles.retryBtn} onClick={handleGenerate}>
              ↻ Regenerate All
            </button>
          </div>
          <div className={styles.cardList}>
            {riskyModules.map(m => (
              <ModuleSuggestionCard
                key={m.filename}
                filename={m.filename}
                tier={m.tier}
                mri={m.mri}
                data={results[m.filename]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
