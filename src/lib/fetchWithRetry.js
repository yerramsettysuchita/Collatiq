export async function fetchWithRetry(url, options = {}, {
  maxAttempts = 3,
  baseDelayMs = 500,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      // Only retry on server errors (5xx) or network errors; 4xx are not retryable
      if (res.status >= 500 && attempt < maxAttempts) {
        lastError = new Error(`HTTP ${res.status}`);
        await delay(baseDelayMs * 2 ** (attempt - 1));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await delay(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
