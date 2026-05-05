import { motion } from 'framer-motion';
import { signInWithGoogle } from '../lib/supabase';
import './DemoMode.css';

/* Pre-filled inputs for the demo walkthrough — Indiranagar, Bengaluru apartment */
export const DEMO_PREFILL = {
  address:   'No. 14, 3rd Cross, Indiranagar 12th Main, Bengaluru 560038',
  type:      'residential',
  subtype:   'Apartment',
  area:      '1250',
  floor:     '3',
  age:       'mid',
  occupancy: 'self',
  legal:     'clear',
};

export function DemoBanner() {
  const handleSignIn = async () => {
    try { await signInWithGoogle(); } catch {}
  };

  return (
    <motion.div
      className="demo-banner"
      initial={{ y: -48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-label="Demo mode — viewing a sample property assessment"
    >
      <div className="demo-banner-inner">
        <div className="demo-banner-left">
          <span className="demo-badge" aria-hidden="true">DEMO</span>
          <span className="demo-banner-text">
            Sample property — Indiranagar, Bengaluru. Results are illustrative only.
          </span>
        </div>
        <button className="demo-signin-btn" onClick={handleSignIn}>
          Sign in to assess your own property
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M1.5 5.5h8M5.5 1.5l4 4-4 4"
              stroke="currentColor" strokeWidth="1.4"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
