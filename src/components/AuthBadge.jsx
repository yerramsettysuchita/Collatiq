import { motion } from 'framer-motion';
import './AuthBadge.css';

export default function AuthBadge({ user, onSignOut }) {
  const email   = user?.email || '';
  const display = email.length > 30 ? email.slice(0, 27) + '...' : email;

  return (
    <motion.div
      className="auth-badge"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-label={`Signed in as ${email}`}
    >
      <div className="auth-badge-inner">
        <div className="auth-badge-left">
          <span className="auth-badge-dot" aria-hidden="true" />
          <span className="auth-badge-email">{display}</span>
        </div>
        <button className="auth-badge-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </motion.div>
  );
}
