const DEFAULT_RPM_LIMIT = 30;
const DEFAULT_BURST_LIMIT = 6;
const DEFAULT_CONCURRENCY_LIMIT = 6;
const DEFAULT_COOLDOWN_SEC = 60;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 8;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function envInt(key, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const raw = String(process.env[key] || "").trim();
  if (!raw) return fallback;
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
}

function getRpmLimit() {
  return envInt("SARVAM_TTS_RPM_LIMIT", DEFAULT_RPM_LIMIT, 1);
}

function getBurstLimit() {
  return envInt(
    "SARVAM_TTS_BURST_LIMIT",
    DEFAULT_BURST_LIMIT,
    MIN_CONCURRENCY,
    MAX_CONCURRENCY,
  );
}

function getConcurrencyLimit(override) {
  const configured = envInt(
    "SARVAM_TTS_CONCURRENCY_LIMIT",
    DEFAULT_CONCURRENCY_LIMIT,
    MIN_CONCURRENCY,
    MAX_CONCURRENCY,
  );
  const requested = Number.isFinite(Number(override))
    ? clamp(parseInt(override, 10), MIN_CONCURRENCY, MAX_CONCURRENCY)
    : configured;
  return Math.min(configured, requested);
}

function getCooldownMs() {
  return envInt("SARVAM_TTS_RATE_COOLDOWN_SEC", DEFAULT_COOLDOWN_SEC, 1) * 1000;
}

const state = {
  tokens: getBurstLimit(),
  maxTokens: getBurstLimit(),
  lastRefillAt: Date.now(),
  cooldownUntil: 0,
  inFlight: 0,
  waiters: [],
};

function refreshConfig() {
  const burst = getBurstLimit();
  if (state.maxTokens !== burst) {
    state.maxTokens = burst;
    state.tokens = Math.min(state.tokens, burst);
  }
}

function refillBucket() {
  refreshConfig();
  const rpm = getRpmLimit();
  const refillIntervalMs = Math.ceil(60_000 / rpm);
  const now = Date.now();
  const elapsed = now - state.lastRefillAt;
  const tokensToAdd = Math.floor(elapsed / refillIntervalMs);

  if (tokensToAdd > 0) {
    state.tokens = Math.min(state.maxTokens, state.tokens + tokensToAdd);
    state.lastRefillAt += tokensToAdd * refillIntervalMs;
  }

  return refillIntervalMs;
}

function isSarvamRateLimitError(err) {
  const status =
    err?.response?.status ??
    err?.status ??
    err?.code ??
    err?.httpStatus;
  if (status === 429) return true;

  const data = err?.response?.data;
  const dataText =
    typeof data === "string" ? data : data ? JSON.stringify(data) : "";
  const msg = `${err?.message || ""} ${dataText}`.toLowerCase();

  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    (msg.includes("quota") && (msg.includes("exceed") || msg.includes("limit")))
  );
}

async function waitForConcurrency(limit) {
  while (state.inFlight >= limit) {
    await new Promise((resolve) => state.waiters.push(resolve));
  }
  state.inFlight += 1;
}

function releaseConcurrency() {
  state.inFlight = Math.max(0, state.inFlight - 1);
  const waiter = state.waiters.shift();
  if (waiter) waiter();
}

async function waitForToken() {
  for (;;) {
    const now = Date.now();
    if (now < state.cooldownUntil) {
      const waitMs = state.cooldownUntil - now + 100;
      console.warn(
        `[sarvamRateLimiter] Cooling down for ${Math.ceil(waitMs / 1000)}s after rate limit`,
      );
      await sleep(waitMs);
      continue;
    }

    const refillIntervalMs = refillBucket();
    if (state.tokens > 0) {
      state.tokens -= 1;
      return;
    }

    const waitMs = Math.max(100, state.lastRefillAt + refillIntervalMs - Date.now());
    console.log(`[sarvamRateLimiter] Token bucket empty, waiting ${waitMs}ms`);
    await sleep(waitMs);
  }
}

function markRateLimited() {
  const cooldown = getCooldownMs();
  state.cooldownUntil = Date.now() + cooldown;
  console.warn(
    `[sarvamRateLimiter] Sarvam rate limit hit; cooling down for ${cooldown / 1000}s`,
  );
}

async function callWithSarvamRateLimit(fn, opts = {}) {
  const maxRetries = Number.isFinite(Number(opts.maxRetries))
    ? Math.max(0, parseInt(opts.maxRetries, 10))
    : 2;
  const concurrencyLimit = getConcurrencyLimit(opts.concurrencyLimit);

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    await waitForConcurrency(concurrencyLimit);
    try {
      await waitForToken();
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isSarvamRateLimitError(err)) throw err;
      markRateLimited();
      if (attempt >= maxRetries) break;
    } finally {
      releaseConcurrency();
    }
  }

  throw lastErr || new Error("Sarvam TTS rate limiter: retries exhausted");
}

function getSarvamRateLimitStatus() {
  refillBucket();
  const now = Date.now();
  return {
    rpmLimit: getRpmLimit(),
    burstLimit: state.maxTokens,
    configuredConcurrencyLimit: getConcurrencyLimit(),
    inFlight: state.inFlight,
    tokens: state.tokens,
    cooldownUntil:
      state.cooldownUntil > now ? new Date(state.cooldownUntil).toISOString() : null,
    waiters: state.waiters.length,
  };
}

function resetSarvamRateLimiter() {
  state.tokens = getBurstLimit();
  state.maxTokens = getBurstLimit();
  state.lastRefillAt = Date.now();
  state.cooldownUntil = 0;
  state.inFlight = 0;
  state.waiters.splice(0).forEach((resolve) => resolve());
}

module.exports = {
  callWithSarvamRateLimit,
  getSarvamRateLimitStatus,
  isSarvamRateLimitError,
  resetSarvamRateLimiter,
};
