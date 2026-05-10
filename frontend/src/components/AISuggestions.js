import React, { useState } from 'react';
import axios from 'axios';
import styles from './AISuggestions.module.css';

const PRIORITY_CFG = {
  IMMEDIATE:   { color: '#e8622a', bg: '#fde8de', icon: '🔥' },
  'SHORT-TERM':{ color: '#d4860a', bg: '#fdf1d6', icon: '⚡' },
  'LONG-TERM': { color: '#2d7a4f', bg: '#d6f0e2', icon: '🗓️' },
};

/** Per-error-code structured help — tied to backend error_code field. */
const ERROR_HELP = {
  401: {
    label: 'Invalid API Key',
    fix:   'Your GROQ_API_KEY in backend/.env is wrong or expired.',
    cta:   'Get a new key at console.groq.com →',
    url:   'https://console.groq.com/',
  },
  403: {
    label: 'Access Denied',
    fix:   'Your Groq account may be inactive or the key revoked.',
    cta:   'Check your Groq account →',
    url:   'https://console.groq.com/',
  },
  404: {
    label: 'Model Not Found',
    fix:   'In backend/.env set: GROQ_MODEL=llama-3.1-8b-instant',
    cta:   null,
    url:   null,
  },
  429: {
    label: 'Rate Limited',
    fix:   'Free tier: ~30 requests/min. Wait a moment and retry.',
    cta:   null,
    url:   null,
  },
};

function SuggestionSkeleton() {
  return (
    <div className={styles.skeleton}>
      {[80, 100, 60, 90, 70].map((w, i) => (
        <div key={i} className={styles.skeletonLine} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function SetupBanner({ onDismiss }) {
  return (
    <div className={styles.setupBanner}>
      <div className={styles.setupIcon}>🤖</div>
      <div className={styles.setupBody}>
        <h4 className={styles.setupTitle}>Set up AI Suggestions</h4>
        <p className={styles.setupText}>
          Add your free Groq API key to <code>backend/.env</code> to unlock AI-powered recommendations.
        </p>
        <div className={styles.setupSteps}>
          {[
            <>Visit <a href="https://console.groq.com/" target="_blank" rel="noreferrer">console.groq.com</a> → Sign up free</>,
            <>Click <strong>API Keys</strong> → <strong>Create API Key</strong></>,
            <>Open <code>backend/.env</code> and replace <code>your_groq_api_key_here</code> with the new key</>,
            <>Restart the backend: <code>python app.py</code></>,
          ].map((step, i) => (
            <div key={i} className={styles.setupStep}>
              <span className={styles.setupStepNum}>{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
      <button className={styles.setupDismiss} onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

function ErrorCard({ data, onRetry }) {
  const help = data.error_code ? ERROR_HELP[data.error_code] : null;

  return (
    <div className={styles.errorCard}>
      <span className={styles.errorIcon}>⚠️</span>
      <div className={styles.errorBody}>
        <p className={styles.errorTitle}>{help ? help.label : 'AI unavailable'}</p>
        <p className={styles.errorMsg}>{data.reason}</p>

        <p className={styles.errorFix}>
          <strong>Fix: </strong>
          {help ? help.fix : data.fix || 'Check backend logs for details.'}
        </p>

        <div className={styles.errorActions}>
          {help?.url && help?.cta && (
            <a href={help.url} target="_blank" rel="noreferrer" className={styles.errorLink}>
              {help.cta}
            </a>
          )}
          {!help?.url && data.setup_url && (
            <a href={data.setup_url} target="_blank" rel="noreferrer" className={styles.errorLink}>
              Get free API key →
            </a>
          )}
          <button className={styles.retryInlineBtn} onClick={onRetry}>
            ↻ Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function SuggestionsDisplay({ data, filename, onRetry }) {
  if (!data.available) {
    return <ErrorCard data={data} onRetry={onRetry} />;
  }

  if (data.skipped) {
    return (
      <div className={styles.skippedCard}>
        <span>✅</span>
        <p>{data.reason}</p>
      </div>
    );
  }

  return (
    <div className={styles.suggestionsWrap}>
      {/* Model badge */}
      <div className={styles.modelBadge}>
        <span className={styles.modelDot} />
        Powered by <strong>{data.model || 'Groq LLM'}</strong>
        <span className={styles.modelNote}>· COBRisk AI Advisor</span>
      </div>

      {/* Summary */}
      <div className={styles.summaryCard}>
        <h4 className={styles.sectionLabel}>🧠 AI Summary</h4>
        <p className={styles.summaryText}>{data.summary}</p>
      </div>

      {/* Top Issues — tied to the highest-scoring MRI dimensions */}
      {data.top_issues?.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>🚨 Top Issues Detected</h4>
          <div className={styles.issueList}>
            {data.top_issues.map((issue, i) => (
              <div key={i} className={styles.issueCard}>
                <div className={styles.issueNum}>{i + 1}</div>
                <div>
                  <div className={styles.issueTitle}>{issue.issue}</div>
                  <div className={styles.issueDetail}>{issue.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Plan — IMMEDIATE → SHORT-TERM → LONG-TERM */}
      {data.action_plan?.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>📋 Action Plan</h4>
          <div className={styles.actionList}>
            {data.action_plan.map((a, i) => {
              const cfg = PRIORITY_CFG[a.priority] || PRIORITY_CFG['LONG-TERM'];
              return (
                <div key={i} className={styles.actionCard}>
                  <span
                    className={styles.priorityBadge}
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.icon} {a.priority}
                  </span>
                  <div className={styles.actionBody}>
                    <div className={styles.actionText}>{a.action}</div>
                    <div className={styles.actionImpact}>→ {a.impact}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Migration Strategy */}
      {data.migration_strategy && (
        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>🗺️ Migration Strategy</h4>
          <div className={styles.strategyCard}>
            <p className={styles.strategyText}>{data.migration_strategy}</p>
          </div>
        </div>
      )}

      {/* Quick Wins + Effort */}
      <div className={styles.bottomRow}>
        {data.quick_wins?.length > 0 && (
          <div className={styles.quickWinsCard}>
            <h4 className={styles.sectionLabel}>⚡ Quick Wins</h4>
            <ul className={styles.quickList}>
              {data.quick_wins.map((qw, i) => (
                <li key={i} className={styles.quickItem}>
                  <span className={styles.quickCheck}>✓</span>
                  {qw}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.estimated_effort && (
          <div className={styles.effortCard}>
            <h4 className={styles.sectionLabel}>⏱️ Estimated Effort</h4>
            <div className={styles.effortValue}>{data.estimated_effort}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AISuggestions({ module, aiConfigured }) {
  const [state, setState]         = useState('idle'); // idle | loading | done
  const [data, setData]           = useState(null);
  const [showSetup, setShowSetup] = useState(!aiConfigured);

  const handleFetch = async () => {
    setState('loading');
    setData(null);
    try {
      const res = await axios.post('https://cobrisk.onrender.com/api/ai-suggest', { module });
      setData(res.data);
      setState('done');
    } catch (e) {
      setData({
        available: false,
        reason:    e.response?.data?.error || 'Network error — is the backend running on port 5000?',
        fix:       'Run: python app.py in the backend directory.',
      });
      setState('done');
    }
  };

  const isMedHigh = module.tier === 'MEDIUM' || module.tier === 'HIGH';
  const tierColor = module.tier === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-med)';

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.aiIcon}>🤖</span>
          <div>
            <h3 className={styles.title}>AI Suggestions</h3>
            <p className={styles.subtitle}>Groq LLM · context-aware migration advice</p>
          </div>
        </div>
        {aiConfigured
          ? <span className={styles.configuredBadge}>● AI Ready</span>
          : <span className={styles.notConfiguredBadge}>○ Not configured</span>
        }
      </div>

      {/* Setup banner (dismissible) */}
      {showSetup && !aiConfigured && (
        <SetupBanner onDismiss={() => setShowSetup(false)} />
      )}

      {/* Content states */}
      {!isMedHigh ? (
        <div className={styles.lowRiskCard}>
          <span>🟢</span>
          <p>
            This module is <strong>LOW risk</strong> (MRI &lt; 35) — no AI suggestions needed.
            It is a good first candidate to migrate: low coupling, low structural complexity.
          </p>
        </div>

      ) : state === 'idle' ? (
        <div className={styles.idleCard}>
          <div className={styles.idleIcon} style={{ color: tierColor }}>
            {module.tier === 'HIGH' ? '🔴' : '🟡'}
          </div>
          <p className={styles.idleText}>
            This module has{' '}
            <strong style={{ color: tierColor }}>{module.tier} risk</strong>{' '}
            (MRI: {module.mri}).{' '}
            {aiConfigured
              ? 'Click below to get AI-powered, context-aware suggestions based on its five MRI dimension scores.'
              : 'Configure your Groq API key in backend/.env to unlock AI suggestions.'}
          </p>
          <button
            className={styles.fetchBtn}
            style={{ '--btn-color': tierColor }}
            onClick={handleFetch}
            disabled={!aiConfigured}
          >
            {aiConfigured ? '✨ Get AI Suggestions' : '🔒 Configure AI First'}
          </button>
        </div>

      ) : state === 'loading' ? (
        <div className={styles.loadingCard}>
          <div className={styles.loadingSpinner} />
          <div className={styles.loadingText}>
            <p className={styles.loadingTitle}>Analyzing with Groq LLM…</p>
            <p className={styles.loadingSubtitle}>
              Reading all five MRI dimensions, nine signals, paragraphs, and coupling patterns…
            </p>
          </div>
          <SuggestionSkeleton />
        </div>

      ) : (
        <>
          <SuggestionsDisplay data={data} filename={module.filename} onRetry={handleFetch} />
          {/* Only show Regenerate if last call succeeded */}
          {data?.available && !data?.skipped && (
            <button className={styles.refetchBtn} onClick={handleFetch}>
              ↻ Regenerate
            </button>
          )}
        </>
      )}
    </div>
  );
}
