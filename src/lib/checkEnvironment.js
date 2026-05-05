const REQUIRED = [
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_ANON_KEY',
];

export function checkEnvironment() {
  const missing = REQUIRED.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn(
      '[Collatiq] Missing environment variables:',
      missing.join(', '),
      '— some features may not work. See .env.example.'
    );
  }
}
