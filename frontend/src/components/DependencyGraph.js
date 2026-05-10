import React, { useEffect, useRef, useState } from 'react';
import styles from './DependencyGraph.module.css';

const TIER_COLORS = {
  HIGH:   '#e8622a',
  MEDIUM: '#d4860a',
  LOW:    '#2d7a4f',
};

export default function DependencyGraph({ graph, onSelect }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const nodesRef  = useRef([]);
  const edgesRef  = useRef([]);
  const [selected, setSelected] = useState(null);
  const [hovered,  setHovered]  = useState(null);
  const dragRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W;
    canvas.height = H;

    // Init nodes with random positions
    nodesRef.current = graph.nodes.map((n, i) => ({
      ...n,
      x: W / 2 + Math.cos((i / graph.nodes.length) * Math.PI * 2) * 180,
      y: H / 2 + Math.sin((i / graph.nodes.length) * Math.PI * 2) * 130,
      vx: 0, vy: 0,
      r: Math.max(22, Math.min(42, 18 + (n.lines || 100) / 80)),
    }));
    edgesRef.current = graph.edges;

    // ── Force simulation loop ──
    const simulate = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 3200 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const e of edges) {
        const src = nodes.find(n => n.id === e.source);
        const tgt = nodes.find(n => n.id === e.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 140) * 0.04;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        src.vx += fx; src.vy += fy;
        tgt.vx -= fx; tgt.vy -= fy;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.015;
        n.vy += (H / 2 - n.y) * 0.015;
      }

      // Apply velocity + damping
      for (const n of nodes) {
        if (dragRef.current && dragRef.current.id === n.id) continue;
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(n.r, Math.min(W - n.r, n.x));
        n.y = Math.max(n.r, Math.min(H - n.r, n.y));
      }
    };

    const draw = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      ctx.clearRect(0, 0, W, H);

      // Draw subtle grid
      ctx.strokeStyle = '#eee9e1';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Draw edges
      for (const e of edges) {
        const src = nodes.find(n => n.id === e.source);
        const tgt = nodes.find(n => n.id === e.target);
        if (!src || !tgt) continue;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = e.type === 'CALL' ? 'rgba(232,98,42,0.35)' : 'rgba(26,95,106,0.3)';
        ctx.lineWidth = e.type === 'CALL' ? 2 : 1.5;
        ctx.setLineDash(e.type === 'COPY' ? [5, 4] : []);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead
        const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        const ax = tgt.x - Math.cos(angle) * (tgt.r + 4);
        const ay = tgt.y - Math.sin(angle) * (tgt.r + 4);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 8 * Math.cos(angle - 0.4), ay - 8 * Math.sin(angle - 0.4));
        ctx.lineTo(ax - 8 * Math.cos(angle + 0.4), ay - 8 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fillStyle = e.type === 'CALL' ? 'rgba(232,98,42,0.5)' : 'rgba(26,95,106,0.45)';
        ctx.fill();
      }

      // Draw nodes
      for (const n of nodes) {
        const color = TIER_COLORS[n.tier] || '#888';
        const isSel = selected === n.id;
        const isHov = hovered  === n.id;

        // Glow
        if (isSel || isHov) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 10, 0, Math.PI * 2);
          const grd = ctx.createRadialGradient(n.x, n.y, n.r, n.x, n.y, n.r + 10);
          grd.addColorStop(0, color + '55');
          grd.addColorStop(1, 'transparent');
          ctx.fillStyle = grd;
          ctx.fill();
        }

        // Shadow
        ctx.shadowColor = color + '50';
        ctx.shadowBlur  = isSel ? 18 : 8;

        // Circle fill
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? color : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth   = isSel ? 3.5 : 2;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // MRI label
        ctx.fillStyle = isSel ? '#ffffff' : color;
        ctx.font = `bold ${Math.max(10, n.r * 0.42)}px 'Syne', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.mri, n.x, n.y - 4);

        // Filename
        const shortName = n.label.replace(/\.(cob|cbl|cpy)$/i, '');
        ctx.font = `500 ${Math.max(9, n.r * 0.3)}px 'DM Sans', sans-serif`;
        ctx.fillStyle = isSel ? '#ffffffcc' : '#5a5248';
        ctx.fillText(shortName, n.x, n.y + n.r * 0.45);
      }
    };

    const loop = () => {
      simulate();
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animRef.current);
  }, [graph, selected]);

  // Mouse interactions
  const getNode = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    return nodesRef.current.find(n => Math.hypot(n.x - mx, n.y - my) <= n.r + 4) || null;
  };

  const handleMouseMove = (e) => {
    const n = getNode(e);
    setHovered(n ? n.id : null);
    canvasRef.current.style.cursor = n ? 'pointer' : 'default';
    if (dragRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      dragRef.current.x  = e.clientX - rect.left;
      dragRef.current.y  = e.clientY - rect.top;
      dragRef.current.vx = 0; dragRef.current.vy = 0;
    }
  };
  const handleMouseDown = (e) => { dragRef.current = getNode(e); };
  const handleMouseUp   = ()  => { dragRef.current = null; };
  const handleClick     = (e) => {
    const n = getNode(e);
    if (n) { setSelected(n.id); onSelect(n); }
    else    setSelected(null);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>Dependency Graph</h2>
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#e8622a' }} /> HIGH risk</span>
          <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#d4860a' }} /> MEDIUM risk</span>
          <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#2d7a4f' }} /> LOW risk</span>
          <span className={styles.legendItem}><span className={styles.line} style={{ borderStyle: 'solid', borderColor: '#e8622a' }} /> CALL</span>
          <span className={styles.legendItem}><span className={styles.line} style={{ borderStyle: 'dashed', borderColor: '#1a5f6a' }} /> COPY</span>
        </div>
      </div>
      <div className={styles.hint}>Click a node for detail · Drag to reposition · Node size = lines of code</div>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
      {graph.nodes.length === 0 && (
        <div className={styles.empty}>No modules to display in graph.</div>
      )}
    </div>
  );
}
