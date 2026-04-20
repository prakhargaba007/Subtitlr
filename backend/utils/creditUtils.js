/**
 * creditUtils.js
 *
 * Central place for every credit-related calculation, query, and mutation.
 * Import what you need; nothing here talks to `res`/`req` directly.
 */

const mongoose = require("mongoose");
const User = require("../models/User");
const CreditTransaction = require("../models/CreditTransaction");

// ─── Constants ────────────────────────────────────────────────────────────────

/** Credits awarded to a temporary (anonymous) user on first visit. */
const DEFAULT_CREDITS = 0;

/** Credits awarded when a user creates a verified account (OTP, Google, email). */
const SIGNUP_CREDITS = 60;

/** How many credits one "unit" costs. 1 credit = 1 started minute of media. */
const CREDITS_PER_MINUTE = 1;

// ─── Calculation helpers ──────────────────────────────────────────────────────

/**
 * How many credits a piece of media of `durationSeconds` length will cost.
 * Rounds UP so a 61-second clip costs 2 credits, not 1.
 *
 * @param {number} durationSeconds
 * @returns {number}
 */
const calculateCreditsNeeded = (durationSeconds) =>
  Math.ceil(durationSeconds / 60) * CREDITS_PER_MINUTE;

/**
 * Convert seconds to a human-readable string, e.g. 125 → "2m 5s".
 *
 * @param {number} seconds
 * @returns {string}
 */
const formatDuration = (seconds) => {
  if (!seconds || seconds < 1) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(" ");
};

// ─── Credit checks ────────────────────────────────────────────────────────────

/**
 * Return true when a user object has at least `creditsNeeded` credits.
 *
 * @param {import('../models/User')} user  - Mongoose User document
 * @param {number} creditsNeeded
 * @returns {boolean}
 */
const hasEnoughCredits = (user, creditsNeeded) =>
  (user.credits ?? 0) >= creditsNeeded;

/**
 * Throw a descriptive 402 error if the user cannot afford the operation.
 *
 * @param {import('../models/User')} user
 * @param {number} creditsNeeded
 */
const assertEnoughCredits = (user, creditsNeeded) => {
  if (!hasEnoughCredits(user, creditsNeeded)) {
    const err = new Error(
      `Insufficient credits. You need ${creditsNeeded} credit(s) but only have ${user.credits ?? 0}.`
    );
    err.statusCode = 402;
    throw err;
  }
};

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Executes a MongoDB transaction with exponential backoff for transient errors.
 */
async function withTransactionRetry(action, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await action(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      if (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError') && attempt < maxRetries) {
        await new Promise(res => setTimeout(res, 100 * attempt));
        continue;
      }
      throw error;
    } finally {
      session.endSession();
    }
  }
}

/**
 * Atomically subtract `amount` credits from a user and record the transaction.
 *
 * @param {string} userId
 * @param {number} amount       - positive integer
 * @param {string} source       - one of the CreditTransaction source enum values
 * @param {string} [description]
 * @param {object} [metadata]   - optional extra data (jobId, fileName, duration, …)
 * @returns {Promise<number>} The new balance after deduction
 */
const deductCredits = async (userId, amount, source, description = "", metadata = {}) => {
  const abs = Math.abs(amount);
  let balanceAfter = 0;

  await withTransactionRetry(async (session) => {
    // 1) Atomic Read-And-Decrement locked by $gte condition
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: abs } },
      { $inc: { credits: -abs } },
      { new: true, session }
    );

    // 2) Handle failure securely
    if (!updatedUser) {
      const userExists = await User.findById(userId).session(session);
      if (!userExists) {
        const err = new Error("User not found when deducting credits.");
        err.statusCode = 404;
        throw err;
      } else {
        const err = new Error(`Insufficient credits`);
        err.statusCode = 402;
        throw err;
      }
    }

    // 3) Mathematically derive precise ledger flow
    balanceAfter = updatedUser.credits || 0;
    const balanceBefore = balanceAfter + abs;

    await CreditTransaction.create([{
      user: userId,
      type: "debit",
      amount: abs,
      balanceBefore,
      balanceAfter,
      source,
      description,
      metadata,
    }], { session });
  });

  return balanceAfter;
};

/**
 * Atomically add `amount` credits to a user and record the transaction.
 * Use this for sign-up bonuses, purchases, refunds, and admin grants.
 *
 * @param {string} userId
 * @param {number} amount       - positive integer
 * @param {string} source       - one of the CreditTransaction source enum values
 * @param {string} [description]
 * @param {object} [metadata]   - optional extra data (paymentId, plan, …)
 * @returns {Promise<number>} The new balance after addition
 */
const addCredits = async (userId, amount, source, description = "", metadata = {}) => {
  const abs = Math.abs(amount);
  let balanceAfter = 0;

  await withTransactionRetry(async (session) => {
    // 1) Atomic Read-And-Increment
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: abs } },
      { new: true, session }
    );

    if (!updatedUser) {
      const err = new Error("User not found when adding credits.");
      err.statusCode = 404;
      throw err;
    }

    // 2) Mathematically derive precise ledger flow
    balanceAfter = updatedUser.credits || 0;
    const balanceBefore = Math.max(0, balanceAfter - abs);

    await CreditTransaction.create([{
      user: userId,
      type: "credit",
      amount: abs,
      balanceBefore,
      balanceAfter,
      source,
      description,
      metadata,
    }], { session });
  });

  return balanceAfter;
};

/**
 * Perform a legally exact refund via a strict atomic transaction.
 * Completely blocks TOCTOU deduplication bugs by deriving remaining thresholds mid-transaction
 * and inherently honoring the idempotencyKey exactly-once unique index.
 */
const processRefundAtomic = async (userId, paymentId, idempotencyKey) => {
  await withTransactionRetry(async (session) => {
    // 1) Evaluate explicit transaction bounds and user capacity synchronously
    const originalTx = await CreditTransaction.findOne({
      user: userId, type: "credit", "metadata.paymentId": paymentId
    }).session(session);

    if (!originalTx) return;

    const maxRefundable = originalTx.amount - (originalTx.metadata.refundedAmount || 0);
    if (maxRefundable <= 0) return;

    const userNow = await User.findById(userId).session(session);
    const actualDeduction = Math.min(maxRefundable, userNow?.credits || 0);
    if (actualDeduction <= 0) return;

    // 2) Bounded increment locked mathematically against static maximum capacity
    const updatedOriginal = await CreditTransaction.findOneAndUpdate(
      { 
        _id: originalTx._id, 
        $or: [
          { "metadata.refundedAmount": { $exists: false } },
          { "metadata.refundedAmount": { $lte: originalTx.amount - actualDeduction } }
        ]
      },
      { $inc: { "metadata.refundedAmount": actualDeduction } },
      { new: true, session }
    );
    if (!updatedOriginal) throw new Error("Refund atomic safety limits breached");

    // 3) Strict atomic $gte read-and-decrement
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: actualDeduction } },
      { $inc: { credits: -actualDeduction } },
      { new: true, session }
    );
    if (!updatedUser) throw new Error("Atomic balance validation failed");

    // 4) Synthesize math-verified ledger continuity
    const balanceAfter = updatedUser.credits || 0;
    const balanceBefore = balanceAfter + actualDeduction;

    await CreditTransaction.create([{
      user: userId,
      type: "debit",
      amount: actualDeduction,
      balanceBefore,
      balanceAfter,
      source: "refund",
      description: `Refund processed for payment ${paymentId}`,
      metadata: { originalPaymentId: paymentId, idempotencyKey },
    }], { session });
  });
};

// ─── History & analytics ──────────────────────────────────────────────────────

/**
 * Paginated, time-ordered list of every credit movement for a user.
 * Covers all transaction types (earn + spend), not just subtitle jobs.
 *
 * @param {string} userId
 * @param {{ page?: number, limit?: number }} [opts]
 * @returns {Promise<{ transactions: object[], total: number, page: number, pages: number }>}
 */
const getCreditHistory = async (userId, { page = 1, limit = 10 } = {}) => {
  page = Math.max(1, page);
  limit = Math.min(50, limit);
  const skip = (page - 1) * limit;

  const [txns, total] = await Promise.all([
    CreditTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CreditTransaction.countDocuments({ user: userId }),
  ]);

  const transactions = txns.map((tx) => ({
    id: tx._id,
    type: tx.type,
    amount: tx.amount,
    balanceBefore: tx.balanceBefore,
    balanceAfter: tx.balanceAfter,
    source: tx.source,
    description: tx.description,
    metadata: tx.metadata,
    date: tx.createdAt,
  }));

  return {
    transactions,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

/**
 * Aggregate credit stats for a user — useful for a dashboard/wallet screen.
 * All totals are derived from the CreditTransaction ledger.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   currentBalance: number,
 *   totalEarned: number,
 *   totalSpent: number,
 *   transactionCount: number,
 *   averageCreditsPerDebit: number,
 *   bySource: Record<string, { count: number, amount: number }>,
 *   recentTransactions: object[]
 * }>}
 */
const getCreditSummary = async (userId) => {
  const objectId = new mongoose.Types.ObjectId(userId.toString());

  const [user, byType, bySource, recentTxns] = await Promise.all([
    User.findById(userId).select("credits").lean(),

    // Total credits earned vs spent
    CreditTransaction.aggregate([
      { $match: { user: objectId } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),

    // Breakdown by source (subtitle_job, signup_bonus, purchase, …)
    CreditTransaction.aggregate([
      { $match: { user: objectId } },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ]),

    // Last 5 transactions for a quick preview
    CreditTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const totals = {
    credit: { total: 0, count: 0 },
    debit: { total: 0, count: 0 },
  };
  byType.forEach(({ _id, total, count }) => {
    totals[_id] = { total, count };
  });

  const bySourceMap = {};
  bySource.forEach(({ _id, count, amount }) => {
    bySourceMap[_id] = { count, amount };
  });

  return {
    currentBalance: user?.credits ?? 0,
    totalEarned: totals.credit.total,
    totalSpent: totals.debit.total,
    transactionCount: totals.credit.count + totals.debit.count,
    averageCreditsPerDebit:
      totals.debit.count > 0
        ? Math.round((totals.debit.total / totals.debit.count) * 100) / 100
        : 0,
    bySource: bySourceMap,
    recentTransactions: recentTxns.map((tx) => ({
      id: tx._id,
      type: tx.type,
      amount: tx.amount,
      source: tx.source,
      description: tx.description,
      balanceAfter: tx.balanceAfter,
      date: tx.createdAt,
    })),
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  DEFAULT_CREDITS,
  SIGNUP_CREDITS,
  CREDITS_PER_MINUTE,
  calculateCreditsNeeded,
  formatDuration,
  hasEnoughCredits,
  assertEnoughCredits,
  deductCredits,
  addCredits,
  processRefundAtomic,
  getCreditHistory,
  getCreditSummary,
};
