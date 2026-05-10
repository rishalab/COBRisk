import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import styles from './LandingPage.module.css';

export default function LandingPage({ onAnalysis }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  const onDrop = useCallback((accepted) => {
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      const fresh = accepted.filter(f => !names.has(f.name));
      return [...prev, ...fresh];
    });
    setError('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.cob', '.cbl', '.cpy', '.CBL', '.COB'] },
    multiple: true,
  });

  const removeFile = (name) => setFiles(f => f.filter(x => x.name !== name));

  const handleAnalyze = async () => {
    if (files.length === 0) { setError('Please upload at least one COBOL file.'); return; }
    setLoading(true); setError(''); setProgress('Parsing modules…');
    nst fd = new FormData();
    files.forEach(f => fd.append('files', f));
    try {
      setProgress('mputing risk metrics…');
      nst res = await axios.post('/api/analyze', fd, {
        headers: { 'ntent-Type': 'multipart/form-data' },
      });
      setProgress('Building dependency graph…');
      await new Promise(r => setTimeout(r, 400));
      onAnalysis(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Analysis failed. Is the backend running?');
    } finally { setLoading(false); setProgress(''); }
  };

  nst handleSample = async () => {
    setLoading(true); setError(''); setProgress('Loading sample BOL files…');
    try {
      setProgress('Analyzing sample debase…');
      nst res = await axios.get('/api/analyze-sample');
      onAnalysis(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Sample load failed. Is the backend running?');
    } finally { setLoading(false); setProgress(''); }
  };

  return (
    <div className={styles.page}>
      {/* Derative blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      <nav className={styles.nav}>
        <div className={styles.logo}>
          <span className={styles.logoIn}>⬡</span>
          <span className={styles.logoText}>COB<span>Risk</span></span>
        </div>
        <div className={styles.navLinks}>
          <a href="https://github.m/rishalab/COBook" target="_blank" rel="noreferrer">GitHub</a>
          <a href="#how">How it works</a>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.badge}>Migration Intelligence Platform</div>
        <h1 className={styles.heroTitle}>
          Know the Risk<br />
          <span className={styles.accent}>Before You Migrate</span>
        </h1>
        <p className={styles.heroSub}>
          COBRisk analyzes your COBOL codebase and scores each module<br />
          across 5 dimensions — so you can migrate smart, not blind.
        </p>
        <div className={styles.heroStats}>
          {[['5', 'Risk Metrics'], ['MRI', 'Composite Score'], ['3', 'Risk Tiers'], ['0', 'Setup Required']].map(([v, l]) => (
            <div key={l} className={styles.heroStat}>
              <span className={styles.heroStatVal}>{v}</span>
              <span className={styles.heroStatLabel}>{l}</span>
            </div>
          ))}
        </div>
      </header>

      <section className={styles.uploadSection}>
        <div className={styles.uploadCard}>
          <h2 className={styles.uploadTitle}>Upload Your COBOL Files</h2>
          <p className={styles.uploadHint}>Accepts <code>.cob</code> · <code>.cbl</code> · <code>.cpy</code></p>

          <div
            {...getRootProps()}
            className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''}`}
          >
            <input {...getInputProps()} />
            <div className={styles.dropzoneIcon}>
              {isDragActive ? '📂' : '📁'}
            </div>
            <p className={styles.dropzoneText}>
              {isDragActive ? 'Drop your files here…' : 'Drag & drop COBOL files, or click to browse'}
            </p>
          </div>

          {files.length > 0 && (
            <div className={styles.fileList}>
              {files.map(f => (
                <div key={f.name} className={styles.fileChip}>
                  <span className={styles.fileChipIcon}>📄</span>
                  <span className={styles.fileChipName}>{f.name}</span>
                  <span className={styles.fileChipSize}>{(f.size / 1024).toFixed(1)} KB</span>
                  <button className={styles.fileChipRemove} onClick={() => removeFile(f.name)}>×</button>
                </div>
              ))}
            </div>
          )}

          {error && <div className={styles.errorBox}>⚠ {error}</div>}

          {loading && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} />
              <span className={styles.progressText}>{progress}</span>
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.btnPrimary}
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? 'Analyzing…' : '⚡ Analyze Risk'}
            </button>
            <button
              className={styles.btnSecondary}
              onClick={handleSample}
              disabled={loading}
            >
              🧪 Try Sample Files
            </button>
          </div>
        </div>
      </section>

      <section id="how" className={styles.howSection}>
        <h2 className={styles.sectionTitle}>How COBRisk Works</h2>
        <div className={styles.steps}>
          {[
            { icon: '📤', step: '01', title: 'Upload', desc: 'Drop your .cob / .cbl / .cpy files. No installation, no mainframe needed.' },
            { icon: '🔬', step: '02', title: 'Parse', desc: 'COBRisk parses divisions, paragraphs, CALL chains, PIC clauses, and file operations.' },
            { icon: '📊', step: '03', title: 'Score', desc: 'Five weighted metrics produce a Migration Risk Index (MRI) per module.' },
            { icon: '🗺️', step: '04', title: 'Decide', desc: 'Visual dependency graph and tier classification tell you exactly what to migrate first.' },
          ].map(s => (
            <div key={s.step} className={styles.stepCard}>
              <span className={styles.stepNum}>{s.step}</span>
              <span className={styles.stepIcon}>{s.icon}</span>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.metricsSection}>
        <h2 className={styles.sectionTitle}>The 5 Risk Dimensions</h2>
        <div className={styles.metricsGrid}>
          {[
            { color: '#e8622a', weight: '30%', name: 'Coupling Density', desc: 'Inbound CALL refs + shared file operations. Tightly coupled modules break migrations.' },
            { color: '#d4860a', weight: '25%', name: 'Documentation Deficit', desc: 'Comment-to-code ratio. Undocumented logic = hidden business rules = migration risk.' },
            { color: '#1a5f6a', weight: '20%', name: 'Logic Volatility', desc: 'GOTO usage + paragraph count. Complex control flow is hard to translate faithfully.' },
            { color: '#8b5cf6', weight: '15%', name: 'Data Complexity', desc: 'REDEFINES + COMP-3 + EBCDIC fields. Tricky data types cause silent bugs after migration.' },
            { color: '#2d7a4f', weight: '10%', name: 'Dead Code Ratio', desc: 'Paragraphs never PERFORMed. Dead code bloats migration scope unnecessarily.' },
          ].map(m => (
            <div key={m.name} className={styles.metricCard}>
              <div className={styles.metricDot} style={{ background: m.color }} />
              <div className={styles.metricWeight} style={{ color: m.color }}>{m.weight}</div>
              <h4 className={styles.metricName}>{m.name}</h4>
              <p className={styles.metricDesc}>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <p>COBRisk · Built for COBOL modernization research · RISHA Lab, IIT Tirupati</p>
      </footer>
    </div>
  );
}
