const Project = require("../models/Project");
const { AI_API_PRICING } = require("../constants/aiPricing");

/**
 * Record AI usage for a project and calculate cost.
 * 
 * @param {string} projectId - The Project ID
 * @param {object} usage - Usage details: { model, inputTokens, outputTokens, inputCharacters, outputCharacters, seconds, meta }
 */
const recordProjectUsage = async (projectId, usage) => {
  if (!projectId) return;
  try {
    const pricing = AI_API_PRICING.find((p) => p.model === usage.model);
    if (!pricing) {
      console.warn(`[usageTracker] No pricing found for model: ${usage.model}`);
      return;
    }

    let costUsd = 0;

    // Calculate cost based on pricing structure
    if (usage.model === "gemini-3.1-pro-preview") {
      const threshold = 200000;
      const inputTokens = usage.inputTokens || 0;
      const outputTokens = usage.outputTokens || 0;
      
      const inputPrice = inputTokens <= threshold ? pricing.inputPricePer1M.under200k : pricing.inputPricePer1M.over200k;
      const outputPrice = inputTokens <= threshold ? pricing.outputPricePer1M.under200k : pricing.outputPricePer1M.over200k;
      
      costUsd = (inputTokens / 1000000) * inputPrice + (outputTokens / 1000000) * outputPrice;
    } else if (pricing.inputPricePer1M && typeof pricing.inputPricePer1M === "object") {
      // Handle models like gemini-3.1-flash-lite-preview with text/audio split
      const inputText = usage.inputTokens || 0;
      const inputAudio = usage.inputAudioTokens || 0;
      const inputPriceText = pricing.inputPricePer1M.text || 0;
      const inputPriceAudio = pricing.inputPricePer1M.audio || 0;
      const outputPrice = pricing.outputPricePer1M.total || pricing.outputPricePer1M || 0;
      
      costUsd = (inputText / 1000000) * inputPriceText + 
                (inputAudio / 1000000) * inputPriceAudio + 
                ((usage.outputTokens || 0) / 1000000) * outputPrice;
    } else if (pricing.inputPricePer1M) {
      // Standard token pricing
      costUsd = ((usage.inputTokens || 0) / 1000000) * pricing.inputPricePer1M + 
                ((usage.outputTokens || 0) / 1000000) * pricing.outputPricePer1M;
    } else if (pricing.pricePer1MChars) {
      // Character pricing (OpenAI TTS, Inworld)
      costUsd = ((usage.inputCharacters || usage.outputCharacters || 0) / 1000000) * pricing.pricePer1MChars;
    } else if (pricing.pricePerSecond) {
      // Per second pricing (Replicate)
      costUsd = (usage.seconds || 0) * pricing.pricePerSecond;
    } else if (pricing.pricePerMinute || pricing.approxPricePerMinute) {
      // Per minute pricing (Whisper, Smallest.ai)
      costUsd = ((usage.seconds || 0) / 60) * (pricing.pricePerMinute || pricing.approxPricePerMinute);
    } else if (pricing.approxPricePer1MCharsUSD) {
      // Sarvam or others with char fallback
      costUsd = ((usage.inputCharacters || usage.outputCharacters || 0) / 1000000) * pricing.approxPricePer1MCharsUSD;
    } else if (pricing.pricePerCharInCredits) {
      // ElevenLabs (approximate USD if we know credit cost)
      const creditCost = 0.00011; // $0.11 per 1000 credits
      const chars = usage.inputCharacters || usage.outputCharacters || 0;
      const credits = chars * pricing.pricePerCharInCredits;
      costUsd = credits * creditCost;
    } else if (pricing.pricePerMinuteInCredits) {
      // ElevenLabs Isolation
      const creditCost = 0.00011;
      const minutes = (usage.seconds || 0) / 60;
      const credits = minutes * pricing.pricePerMinuteInCredits;
      costUsd = credits * creditCost;
    }

    // Update Project
    await Project.findByIdAndUpdate(projectId, {
      $push: {
        aiUsage: {
          model: usage.model,
          provider: pricing.provider,
          type: pricing.type,
          inputTokens: usage.inputTokens || 0,
          outputTokens: usage.outputTokens || 0,
          inputCharacters: usage.inputCharacters || 0,
          outputCharacters: usage.outputCharacters || 0,
          seconds: usage.seconds || 0,
          costUsd: costUsd,
          meta: usage.meta
        }
      },
      $inc: { totalCostUsd: costUsd }
    });

  } catch (err) {
    console.error(`[usageTracker] Failed to record usage for project ${projectId}:`, err);
  }
};

/**
 * Helper to find Project ID by Job ID
 */
const findProjectIdByJobId = async (jobId, kind) => {
  const query = kind === "dubbing" ? { dubbingJob: jobId } : { subtitleJob: jobId };
  const project = await Project.findOne(query);
  return project ? project._id : null;
};

module.exports = { recordProjectUsage, findProjectIdByJobId };
