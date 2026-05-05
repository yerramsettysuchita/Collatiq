import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './styles/globals.css';
import ErrorBoundary from './components/ErrorBoundary';
import { checkEnvironment } from './lib/checkEnvironment';
import { saveAssessment } from './lib/assessmentStorage';
import { hydrateInputFromSavedAssessment } from './lib/hydrateInput';
import { saveFilesForAssessment } from './lib/fileStorage';
import { supabase } from './lib/supabase';
import { DemoBanner } from './components/DemoMode';
import RecentAssessments from './screens/RecentAssessments';
import ComparisonView from './screens/ComparisonView';
import AuthScreen from './screens/AuthScreen';
import Topbar from './components/Topbar';
import Hero from './components/Hero';
import {
  StatsStrip, Features, HowItWorks,
  CalibrationSection, PainPoints, MarketContextBand,
  BengaluruMarketSection,
} from './components/Sections';
import InputScreen from './components/InputScreen';
import ProcessingScreen from './components/ProcessingScreen';
import ResultsScreen from './components/ResultsScreen';

/* ── Is Supabase wired up? ───────────────────────────────────────────────── */
const SUPABASE_CONFIGURED =
  Boolean(process.env.REACT_APP_SUPABASE_URL) &&
  !String(process.env.REACT_APP_SUPABASE_URL).includes('placeholder');

/* ── CURSOR ─────────────────────────────────────────────────────────────────── */
function Cursor() {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);
  const pos  = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.left = e.clientX + 'px';
        dotRef.current.style.top  = e.clientY + 'px';
      }
    };
    const onOver = (e) => {
      const el = e.target;
      const interactive = el.closest('button, a, input, [role="button"], .type-tile, .chip, .slider-input, .preset-btn');
      setExpanded(!!interactive);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseover', onOver);

    let raf;
    const animate = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.11;
      ring.current.y += (pos.current.y - ring.current.y) * 0.11;
      if (ringRef.current) {
        ringRef.current.style.left = ring.current.x + 'px';
        ringRef.current.style.top  = ring.current.y + 'px';
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className={`cursor ${expanded ? 'cursor--expanded' : ''}`} ref={dotRef} />
      <div className={`cursor-ring ${expanded ? 'cursor-ring--expanded' : ''}`} ref={ringRef} />
    </>
  );
}

/* ── HOW IT WORKS MODAL ──────────────────────────────────────────────────── */
const HOW_STEPS = [
  'You type in the property address. Collatiq pins it on the map, confirms the location, and pulls the government circle rate for that specific area.',
  'The engine maps what is around the property. It checks how close the nearest metro station is, what schools and hospitals are nearby, and how many similar listings are competing in the same area.',
  'The government floor rate for that area sets the baseline. The engine then adjusts it based on location quality and layers in factors specific to the building itself.',
  'A separate liquidity model works out how long a sale would realistically take and what the property would fetch in a forced sale, not just in a normal market.',
  'Everything feeds into a single verdict with a recommended loan-to-value range. The reasoning behind every number is written out so your team can follow it from input to conclusion.',
];

function InfoModal({ onClose }) {
  const modalRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = modalRef.current?.querySelectorAll(
        'button, a, input, [tabindex="0"]'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []); // eslint-disable-line

  return (
    <motion.div
      className="info-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How it works"
    >
      <motion.div
        ref={modalRef}
        className="info-modal"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
      >
        <div className="info-modal-header">
          <span className="info-modal-title">How it works</span>
          <button
            ref={closeRef}
            className="info-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <ol className="info-steps">
          {HOW_STEPS.map((step, i) => (
            <motion.li
              key={i}
              className="info-step"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 + 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="info-step-num">{i + 1}</span>
              <span className="info-step-text">{step}</span>
            </motion.li>
          ))}
        </ol>
      </motion.div>
    </motion.div>
  );
}

function InfoButton({ onClick }) {
  return (
    <button className="info-float-btn" onClick={onClick} aria-label="How it works">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M10 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="6.5" r="0.8" fill="currentColor"/>
      </svg>
    </button>
  );
}

/* ── LANDING PAGE ────────────────────────────────────────────────────────────── */
function LandingPage({ onAssess, onRecent, user, onSignOut }) {
  return (
    <>
      {/* onRecent goes only to Topbar (centre nav), never to Hero */}
      <Topbar onAssess={onAssess} onRecent={onRecent} user={user} onSignOut={onSignOut} />
      <main>
        <Hero onAssess={onAssess} />
        <MarketContextBand />
        <StatsStrip />
        <Features />
        <HowItWorks />
        <BengaluruMarketSection onAssess={onAssess} />
        <CalibrationSection />
        <PainPoints />
        <FooterCTA onAssess={onAssess} />
      </main>
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <span className="footer-wordmark">Collat<em>iq</em></span>
        <span className="footer-tagline">Collateral intelligence for Indian NBFCs.</span>
      </div>
      <p className="footer-disclaimer">
        All valuations are model-generated estimates. They are not certified property valuations
        and should not be used as the sole basis for a lending decision.
      </p>
    </footer>
  );
}

function FooterCTA({ onAssess }) {
  return (
    <section className="footer-cta-section">
      <div className="footer-cta-left">
        <h2 className="footer-cta-h2">Ready to assess your first collateral?</h2>
        <p className="footer-cta-sub">
          Stop waiting on broker opinions that take days and cost thousands. Collatiq gives
          your team a complete collateral assessment the moment you need one, with everything
          documented and explained.
        </p>
        <div className="footer-cta-actions">
          <button className="fcta-btn-primary" onClick={onAssess}>Assess a property →</button>
        </div>
      </div>
      <div className="proof-card">
        <div className="proof-metric">
          <div className="pm-num">&lt; 30s</div>
          <div className="pm-label">Report time</div>
        </div>
        <div className="proof-metric">
          <div className="pm-num">12</div>
          <div className="pm-label">Valuation factors</div>
        </div>
        <div className="proof-metric">
          <div className="pm-num">0</div>
          <div className="pm-label">Broker visits</div>
        </div>
        <div className="proof-metric">
          <div className="pm-num">8.5%</div>
          <div className="pm-label">Model error</div>
        </div>
      </div>
    </section>
  );
}

/* ── TRANSITIONS ─────────────────────────────────────────────────────────────── */
const slideLeft = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.55, ease: [0.16,1,0.3,1] } },
  exit:    { x: '-8%', opacity: 0, transition: { duration: 0.35, ease: [0.7,0,0.84,0] } },
};
const slideUp = {
  initial: { y: '5%', opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.55, ease: [0.16,1,0.3,1] } },
  exit:    { y: '-3%', opacity: 0, transition: { duration: 0.3, ease: [0.7,0,0.84,0] } },
};
const slideBack = {
  initial: { x: '-8%', opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.55, ease: [0.16,1,0.3,1] } },
  exit:    { x: '100%', opacity: 0, transition: { duration: 0.35, ease: [0.7,0,0.84,0] } },
};

const TITLES = {
  landing:    'Collatiq — Collateral Intelligence for Indian NBFCs',
  auth:       'Sign In — Collatiq',
  input:      'Assess a Property — Collatiq',
  processing: 'Analysing — Collatiq',
  recent:     'Recent Assessments — Collatiq',
  compare:    'Compare Assessments — Collatiq',
};

/* ── MAIN APP ────────────────────────────────────────────────────────────────── */
export default function App() {
  const [user,            setUser]            = useState(null);
  const [isDemo,          setIsDemo]          = useState(false);
  const [screen,          setScreen]          = useState('landing');
  const [dir,             setDir]             = useState('forward');
  const [formInputs,      setForm]            = useState(null);
  const [results,         setResults]         = useState(null);
  const [saveStatus,      setSaveStatus]      = useState(null);
  const [showInfo,        setShowInfo]        = useState(false);
  const [historyPreFill,  setHistoryPreFill]  = useState(null);
  const [compareEntries,  setCompareEntries]  = useState(null);

  /* ── Auth state listener ── */
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;

    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Keep in sync with Supabase auth events (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line

  useEffect(() => { checkEnvironment(); }, []);

  // Deep link: ?v= restores a saved result
  useEffect(() => {
    const vid = new URLSearchParams(window.location.search).get('v');
    if (vid) {
      try {
        const stored = sessionStorage.getItem(vid);
        if (stored) { setResults(JSON.parse(stored)); setScreen('results'); }
      } catch {}
    }
  }, []);

  // Document title
  useEffect(() => {
    if (screen === 'results' && results?.verdict) {
      const addr = results.address ? results.address.split(',')[0].trim() : '';
      document.title = addr
        ? `${results.verdict} — ${addr} — Collatiq`
        : `${results.verdict} — Collatiq`;
    } else {
      document.title = TITLES[screen] || 'Collatiq';
    }
  }, [screen, results]);

  const goTo = (next, direction = 'forward') => {
    setDir(direction);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  /* ── CTAs ── */
  const handleAssess = () => {
    // Gate behind auth only when Supabase is configured and user is not logged in
    if (SUPABASE_CONFIGURED && !user) {
      goTo('auth');
    } else {
      goTo('input');
    }
  };

  const handleBack   = () => goTo('landing', 'back');
  const handleRecent = () => goTo('recent');

  /* ── Auth handlers ── */
  const handleAuthSuccess = () => {
    // After sign-up or sign-in, go straight to the estimate form
    goTo('input');
  };

  const handleSignOut = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setUser(null);
    setForm(null);
    setResults(null);
    setSaveStatus(null);
    setHistoryPreFill(null);
    setIsDemo(false);
    goTo('landing', 'back');
  };

  /* ── Flow handlers ── */
  const handleSubmit = (inputs) => {
    setForm(inputs);
    setResults(null);
    setSaveStatus(null);
    goTo('processing');
  };

  const handleRevalidate = (entry) => {
    const hydrated = hydrateInputFromSavedAssessment(entry);
    setHistoryPreFill(hydrated);
    goTo('input');
  };

  const handleDiscardEdit = () => {
    setHistoryPreFill(null);
    goTo('recent', 'back');
  };

  const handleCompare = (entries) => {
    setCompareEntries(entries);
    goTo('compare');
  };

  const handleViewSaved = (entry) => {
    // Use the stored full result snapshot when available; fall back to partial data
    const res = entry.fullResult
      ? { ...entry.fullResult, _fromHistory: true }
      : { ...entry, verdictLabel: entry.verdict, ltvBand: entry.ltvBand, _fromHistory: true };
    setResults(res);
    goTo('results', 'up');
  };

  const handleProcessingDone = (newResults) => {
    if (newResults) {
      setResults(newResults);
      if (!isDemo) {
        const { ok } = saveAssessment(newResults, formInputs);
        if (ok) {
          // Persist images + documents to IndexedDB, keyed by assessment ID
          const aid = newResults.valuationId || newResults.id;
          saveFilesForAssessment(
            aid,
            formInputs?._imageFiles  || [],
            formInputs?.documents    || {},
          ).catch(() => {});
        }
        setSaveStatus(ok ? 'saved' : 'failed');
        setTimeout(() => setSaveStatus(null), 4000);
      }
    }
    goTo('results', 'up');
  };

  const handleReset = () => {
    setForm(null);
    setResults(null);
    setSaveStatus(null);
    if (isDemo) { setIsDemo(false); setHistoryPreFill(null); }
    goTo('landing', 'back');
  };

  const variant = dir === 'back' ? slideBack : dir === 'up' ? slideUp : slideLeft;

  // "Recent assessments" in the Topbar is only accessible when logged in
  // (or when Supabase is not configured — anonymous / dev mode)
  const recentAllowed = !SUPABASE_CONFIGURED || !!user;

  return (
    <ErrorBoundary>
      <>
        <Cursor />

        {/* Demo banner — shown during demo walkthrough */}
        {isDemo && <DemoBanner onExit={handleReset} />}

        <div className={isDemo ? 'app-demo-offset' : ''}>
          <div className="grain-overlay" />

          <AnimatePresence mode="wait" initial={false}>
            {screen === 'landing' && (
              <motion.div key="landing" {...variant} style={{ position: 'relative' }}>
                <LandingPage
                  onAssess={handleAssess}
                  onRecent={recentAllowed ? handleRecent : null}
                  user={user}
                  onSignOut={handleSignOut}
                />
              </motion.div>
            )}

            {screen === 'auth' && (
              <motion.div key="auth" {...slideLeft} style={{ position: 'relative' }}>
                <AuthScreen
                  onBack={() => goTo('landing', 'back')}
                  onAuthSuccess={handleAuthSuccess}
                />
              </motion.div>
            )}

            {screen === 'input' && (
              <motion.div key="input" {...slideLeft} style={{ position: 'relative' }}>
                <InputScreen
                  onSubmit={handleSubmit}
                  onBack={handleBack}
                  prefill={historyPreFill}
                  onDiscardEdit={historyPreFill?._editingFrom ? handleDiscardEdit : null}
                />
              </motion.div>
            )}

            {screen === 'recent' && (
              <motion.div key="recent" {...slideLeft} style={{ position: 'relative' }}>
                <RecentAssessments
                  onBack={handleBack}
                  onAssess={handleAssess}
                  onViewResult={handleViewSaved}
                  onRerun={handleRevalidate}
                  onCompare={handleCompare}
                />
              </motion.div>
            )}

            {screen === 'compare' && (
              <motion.div key="compare" {...slideLeft} style={{ position: 'relative' }}>
                <ComparisonView
                  entries={compareEntries}
                  onBack={() => goTo('recent', 'back')}
                  onLoadVersion={handleViewSaved}
                  onRerun={handleRevalidate}
                />
              </motion.div>
            )}

            {screen === 'processing' && (
              <motion.div key="processing" {...slideLeft} style={{ position: 'relative' }}>
                <ProcessingScreen
                  formInputs={formInputs}
                  onComplete={handleProcessingDone}
                  onBack={() => goTo('input', 'back')}
                />
              </motion.div>
            )}

            {screen === 'results' && results && (
              <motion.div key="results" {...slideUp} style={{ position: 'relative' }}>
                <ResultsScreen
                  results={results}
                  onReset={handleReset}
                  saveStatus={saveStatus}
                  onViewRecent={handleRecent}
                  onRerun={results._fromHistory
                    ? () => handleRevalidate({ inputs: results.inputs || {} })
                    : null}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {screen !== 'processing' && (
            <InfoButton onClick={() => setShowInfo(true)} />
          )}

          <AnimatePresence>
            {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
          </AnimatePresence>
        </div>
      </>
    </ErrorBoundary>
  );
}
