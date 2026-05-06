/**
 * geminiKeyManager.js
 *
 * Manages a pool of Gemini API keys with:
 *  - Round-robin distribution across all available keys
 *  - Automatic 429 / RESOURCE_EXHAUSTED failover to the next key
 *  - Per-key cool-down before re-enabling an exhausted key
 *  - Per-key token bucket to stay under the per-minute rate limit
 *
 * Keys read from env (any subset works — missing keys are skipped):
 *   GOOGLE_API_KEY   → slot 0
 *   GOOGLE_API_KEY1  → slot 1
 *   GOOGLE_API_KEY2  → slot 2
 *
 * Environment overrides:
 *   GEMINI_RPM_LIMIT        — requests per minute per key (default: 10)
 *   GEMINI_KEY_COOLDOWN_SEC — seconds before an exhausted key is re-tried (default: 60)
 */

const { GoogleGenAI } = require("@google/genai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Config ────────────────────────────────────────────────────────────────────

const getRpmLimit = () => {
  const v = parseInt(process.env.GEMINI_RPM_LIMIT || "10", 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
};

const getCooldownMs = () => {
  const v = parseInt(process.env.GEMINI_KEY_COOLDOWN_SEC || "60", 10);
  return (Number.isFinite(v) && v > 0 ? v : 60) * 1000;
};

// ── Key pool ──────────────────────────────────────────────────────────────────

/**
 * Build the key pool from env vars on first use.
 * Each entry: { label, key, exhaustedUntil, tokenBucket }
 */
let _pool = null;

function buildPool() {
  const candidates = [
    { label: "GOOGLE_API_KEY", key: process.env.GOOGLE_API_KEY },
    { label: "GOOGLE_API_KEY1", key: process.env.GOOGLE_API_KEY1 },
    { label: "GOOGLE_API_KEY2", key: process.env.GOOGLE_API_KEY2 },
  ];

  const now = Date.now();
  const rpm = getRpmLimit();
  // Refill interval in ms: one token per (60000 / rpm) ms
  const refillIntervalMs = Math.ceil(60_000 / rpm);

  const pool = candidates
    .filter((c) => typeof c.key === "string" && c.key.trim())
    .map((c) => ({
      label: c.label,
      key: c.key.trim(),
      exhaustedUntil: 0, // timestamp; 0 = available
      // Token bucket state
      tokens: rpm,
      maxTokens: rpm,
      lastRefillAt: now,
      refillIntervalMs,
    }));

  if (!pool.length) {
    throw new Error(
      "geminiKeyManager: No Gemini API keys found. " +
        "Set at least one of GOOGLE_API_KEY, GOOGLE_API_KEY1, GOOGLE_API_KEY2.",
    );
  }

  console.log(
    `[geminiKeyManager] Initialized pool with ${pool.length} key(s): ${pool.map((k) => k.label).join(", ")} | RPM limit: ${rpm}`,
  );

  return pool;
}

function getPool() {
  if (!_pool) _pool = buildPool();
  return _pool;
}

// Round-robin pointer (index into pool)
let _rrIndex = 0;

// ── Token bucket helpers ──────────────────────────────────────────────────────

function refillBucket(entry) {
  const now = Date.now();
  const elapsed = now - entry.lastRefillAt;
  const tokensToAdd = Math.floor(elapsed / entry.refillIntervalMs);
  if (tokensToAdd > 0) {
    entry.tokens = Math.min(entry.maxTokens, entry.tokens + tokensToAdd);
    entry.lastRefillAt = now + (elapsed % entry.refillIntervalMs) - elapsed; // keep fractional
    entry.lastRefillAt = now;
  }
}

/** Wait until the given entry has at least 1 token, then consume it. */
async function consumeToken(entry) {
  refillBucket(entry);
  if (entry.tokens > 0) {
    entry.tokens -= 1;
    return;
  }
  // Need to wait for next refill
  const waitMs = entry.refillIntervalMs;
  console.log(
    `[geminiKeyManager] ${entry.label} token bucket empty — waiting ${waitMs}ms`,
  );
  await new Promise((r) => setTimeout(r, waitMs));
  refillBucket(entry);
  entry.tokens = Math.max(0, entry.tokens - 1);
}

// ── Key selection ─────────────────────────────────────────────────────────────

/** Return true if this key is currently available (not exhausted). */
function isAvailable(entry) {
  return Date.now() >= entry.exhaustedUntil;
}

/**
 * Pick the next available key using round-robin.
 * If all keys are exhausted, waits for the soonest recovery.
 */
async function pickKey() {
  const pool = getPool();
  const now = Date.now();

  // First pass: find the next non-exhausted key (round-robin)
  for (let i = 0; i < pool.length; i++) {
    const idx = (_rrIndex + i) % pool.length;
    if (isAvailable(pool[idx])) {
      _rrIndex = (idx + 1) % pool.length; // advance pointer for next call
      return pool[idx];
    }
  }

  // All keys exhausted — wait for the soonest to recover
  const soonest = pool.reduce((a, b) =>
    a.exhaustedUntil < b.exhaustedUntil ? a : b,
  );
  const waitMs = Math.max(0, soonest.exhaustedUntil - Date.now()) + 100;
  console.warn(
    `[geminiKeyManager] All keys exhausted — waiting ${Math.ceil(waitMs / 1000)}s for ${soonest.label} to recover`,
  );
  await new Promise((r) => setTimeout(r, waitMs));
  soonest.exhaustedUntil = 0;
  return soonest;
}

/** Mark a key as exhausted after a 429 error. */
function markExhausted(entry) {
  const cooldown = getCooldownMs();
  entry.exhaustedUntil = Date.now() + cooldown;
  console.warn(
    `[geminiKeyManager] ${entry.label} marked exhausted for ${cooldown / 1000}s`,
  );
}

// ── Rate-limit / quota error detection ───────────────────────────────────────

function isQuotaError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  const status = err?.status ?? err?.code ?? err?.httpStatus;
  if (status === 429) return true;
  if (msg.includes("429")) return true;
  if (msg.includes("resource_exhausted") || msg.includes("resource exhausted"))
    return true;
  if (msg.includes("quota") && msg.includes("exceed")) return true;
  if (msg.includes("rate limit")) return true;
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call `fn(apiKey)` with automatic key rotation on 429.
 *
 * `fn` receives the raw API key string so it can construct whichever
 * Gemini client it needs (GoogleGenAI or GoogleGenerativeAI).
 *
 * @param {(apiKey: string) => Promise<T>} fn
 * @param {{ maxRetries?: number }} [opts]
 * @returns {Promise<T>}
 */
async function callWithRetry(fn, opts = {}) {
  const pool = getPool();
  const maxRetries = opts.maxRetries ?? pool.length * 2;

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const entry = await pickKey();
    await consumeToken(entry);

    try {
      return await fn(entry.key);
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err)) {
        markExhausted(entry);
        console.warn(
          `[geminiKeyManager] 429 on ${entry.label} (attempt ${attempt + 1}/${maxRetries + 1}) — rotating to next key`,
        );
        continue; // retry with next key
      }
      throw err; // non-quota error → propagate immediately
    }
  }

  throw lastErr || new Error("geminiKeyManager: all retries exhausted");
}

/**
 * Get a GoogleGenAI client (@google/genai) for the next available key.
 * Prefer `callWithRetry` for automatic failover; use this only when you
 * need the client object directly.
 */
async function getGenAIClient() {
  const entry = await pickKey();
  await consumeToken(entry);
  return { client: new GoogleGenAI({ apiKey: entry.key }), entry };
}

/**
 * Get a GoogleGenerativeAI client (@google/generative-ai) for the next key.
 */
async function getGenerativeAIClient() {
  const entry = await pickKey();
  await consumeToken(entry);
  return { client: new GoogleGenerativeAI(entry.key), entry };
}

/**
 * Returns the current health status of the key pool.
 * Useful for health-check endpoints.
 */
function getStatus() {
  const pool = getPool();
  const now = Date.now();
  return pool.map((e) => ({
    label: e.label,
    available: isAvailable(e),
    exhaustedUntil: e.exhaustedUntil > now ? new Date(e.exhaustedUntil).toISOString() : null,
    tokens: e.tokens,
    maxTokens: e.maxTokens,
  }));
}

/**
 * Reset the pool (useful for tests or after env changes).
 */
function resetPool() {
  _pool = null;
  _rrIndex = 0;
}

module.exports = {
  callWithRetry,
  getGenAIClient,
  getGenerativeAIClient,
  getStatus,
  resetPool,
};
