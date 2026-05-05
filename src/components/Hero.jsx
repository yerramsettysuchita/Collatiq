import { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import './Hero.css';

const BuildingScene = lazy(() => import('../scenes/BuildingScene'));

const AGENTS = [
  { id: 'geo',  label: 'Location resolved',   status: 'active',   delay: 0.6 },
  { id: 'val',  label: 'Valuation running',    status: 'scanning', delay: 1.0 },
  { id: 'liq',  label: 'Liquidity index',      status: 'scanning', delay: 1.4 },
  { id: 'risk', label: 'Two risk flags found', status: 'active',   delay: 1.8 },
  { id: 'conf', label: 'Confidence at 0.72',   status: 'active',   delay: 2.2 },
];

function AgentCard({ label, status, delay }) {
  return (
    <motion.div
      className="agent-card"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className={`agent-dot ${status}`} />
      <span className="agent-label">{label}</span>
      {status === 'scanning' && (
        <div className="agent-bar"><div className="agent-bar-fill" /></div>
      )}
    </motion.div>
  );
}

function DecisionBadge() {
  return (
    <motion.div
      className="decision-badge"
      initial={{ opacity: 0, scale: 0.88, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 3.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="badge-body">
        <span className="badge-tag">VERDICT</span>
        <span className="badge-value">Sanction Recommended</span>
      </div>
    </motion.div>
  );
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
});

export default function Hero({ onAssess }) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouse({
      x: (e.clientX - rect.left - rect.width / 2) / (rect.width / 2),
      y: (e.clientY - rect.top - rect.height / 2) / (rect.height / 2),
    });
  };

  return (
    <section className="hero" onMouseMove={handleMouseMove}>

      {/* ── LEFT COLUMN 52% ─────────────────────────────────── */}
      <div className="hero-left">
        <div className="hero-left-rule" />
        <div className="hero-content">

          <motion.div className="hero-eyebrow" {...fadeUp(0.1)}>
            <span className="eyebrow-line" />
            <span className="eyebrow-text">AI Collateral Intelligence · 19 Indian Cities · Real-time</span>
          </motion.div>

          <motion.h1 className="hero-h1" {...fadeUp(0.2)}>
            Know what it's worth.<br />
            <em>Know if you can exit it.</em>
          </motion.h1>

          <motion.p className="hero-sub" {...fadeUp(0.32)}>
            Most lenders wait three to five days for a valuation that often turns out to be
            wrong. Collatiq gives your team the full picture in under thirty seconds, with
            every assumption shown and every number explained.
          </motion.p>

          <motion.div className="hero-actions" {...fadeUp(0.44)}>
            <button className="hero-btn-primary" onClick={onAssess}>
              Assess a property
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </motion.div>

          <motion.div className="hero-metrics" {...fadeUp(0.56)}>
            <div className="hero-metric">
              <div className="hm-num">&lt; 30s</div>
              <div className="hm-label">Report turnaround</div>
            </div>
            <div className="hm-divider" />
            <div className="hero-metric">
              <div className="hm-num">19</div>
              <div className="hm-label">Cities covered</div>
            </div>
            <div className="hm-divider" />
            <div className="hero-metric">
              <div className="hm-num">8.5%</div>
              <div className="hm-label">Avg model error</div>
            </div>
            <div className="hm-divider" />
            <div className="hero-metric">
              <div className="hm-num">500+</div>
              <div className="hm-label">Coverage zones</div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* ── RIGHT COLUMN 48% ─────────────────────────────────── */}
      <div className="hero-right">
        <div className="scene-canvas">
          <Suspense fallback={<div className="lazy-spinner-wrap"><div className="lazy-spinner" /></div>}>
            <BuildingScene mouseX={mouse.x} mouseY={mouse.y} />
          </Suspense>
        </div>

        <div className="agents-left">
          {AGENTS.slice(0, 3).map(a => <AgentCard key={a.id} {...a} />)}
        </div>
        <div className="agents-right">
          {AGENTS.slice(3).map(a => <AgentCard key={a.id} {...a} />)}
        </div>

        <DecisionBadge />

        <motion.div
          className="prop-label"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Property 1 of 1
        </motion.div>

        <motion.div
          className="conf-ring-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6 }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="27" fill="none" stroke="var(--ink-6)" strokeWidth="2.5"/>
            <circle cx="32" cy="32" r="27" fill="none" stroke="var(--accent)"
              strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={`${0.72 * 169.6} ${169.6}`}
              strokeDashoffset="42.4"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '32px 32px' }}
            />
            <text x="32" y="37" textAnchor="middle"
              style={{ fontFamily: "'DM Serif Display', serif", fontSize: '14px', fill: 'var(--ink)' }}>
              0.72
            </text>
          </svg>
          <span className="conf-ring-label">confidence</span>
        </motion.div>
      </div>

    </section>
  );
}
