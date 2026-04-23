# AI Dubbing Platform - Cost Optimization & Limits Architecture Plan (Gemini & Inworld Only)

This document details the cost analysis of the dubbing pipeline strictly using **Gemini** (for Transcription, Translation, Voice Selection, and TTS) and **Inworld** (for TTS). All pricing is modeled mathematically based on the provided inputs.

## User Review Required
> [!IMPORTANT]
> Please review the "Dynamic Credit System" and the "Cost Formula". The analysis assumes a text output token cost of $1/1M for Gemini (same as input) since it was not explicitly provided. If your text output pricing differs, the base cost will shift slightly, though TTS remains the primary cost driver.

---

## 1. Full Pipeline Cost Breakdown

### Assumptions
*   **1 minute audio** = 60 seconds
*   **Characters per minute** = 1,000 chars
*   **Gemini Audio Input Tokens** = seconds × 25
*   **Gemini Audio Output Tokens** = seconds × 25
*   **Gemini Text Output Cost** = $1 per 1M tokens (Assumed same as input for simplicity)
*   **Segments**: 15 segments for 1 min, 150 segments for 10 min
*   **Speakers**: 2 for 1 min, 4 for 10 min
*   **LLM Context Overhead**: ~1,000 tokens for system prompts across steps.

### A. Gemini Costs (Pre-TTS)
These steps are identical regardless of the TTS provider chosen.

| Step | Metric (1 Min) | Tokens (1 Min) | Metric (10 Min) | Tokens (10 Min) |
| :--- | :--- | :--- | :--- | :--- |
| **Audio Input** | 60s | 1,500 | 600s | 15,000 |
| **Transcription (Text Out)** | 15 segments | ~300 | 150 segments | ~3,000 |
| **Translation (Text In)** | 1,000 chars + prompt | ~1,500 | 10,000 chars + prompt | ~10,000 |
| **Translation (Text Out)** | 1,000 chars | ~500 | 10,000 chars | ~5,000 |
| **Voice Selection (Text In)** | 2 speakers | ~1,000 | 4 speakers | ~2,000 |
| **Voice Selection (Text Out)**| 2 selections | ~100 | 4 selections | ~200 |
| **Total Input Tokens** | Audio + Text | **4,000** | Audio + Text | **27,000** |
| **Total Output Tokens** | Text | **900** | Text | **8,200** |

**Pre-TTS Cost Calculation ($1 / 1M Input & Output):**
*   **1 Minute:** `(4,000 + 900) * ($1 / 1,000,000)` = **$0.0049**
*   **10 Minute:** `(27,000 + 8,200) * ($1 / 1,000,000)` = **$0.0352**

### B. TTS Costs

| Provider | Pricing | Usage (1 Min) | Cost (1 Min) | Usage (10 Min) | Cost (10 Min) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gemini TTS** | $20 / 1M tokens | 1,500 tokens (60s) | **$0.030** | 15,000 tokens (600s) | **$0.300** |
| **Inworld TTS**| $50 / 1M chars | 1,000 chars | **$0.050** | 10,000 chars | **$0.500** |

### C. Final Total Cost per Request

| Configuration | 1 Minute | 10 Minutes |
| :--- | :--- | :--- |
| **Gemini-Only Pipeline** (Pre-TTS + Gemini TTS) | **$0.0349** | **$0.3352** |
| **Gemini + Inworld Pipeline** (Pre-TTS + Inworld TTS) | **$0.0549** | **$0.5352** |

---

## 2. Cost Formula

This precise formula dynamically models cost per minute without hardcoding flat numbers.

**Parameters:**
*   `D` = Duration in minutes
*   `CPM` = Characters per minute (avg 1000)
*   `T_IN` = Base text input tokens per minute (~1500)
*   `T_OUT` = Base text output tokens per minute (~900)
*   `S` = Extra speakers beyond 1 (adds ~500 input tokens each)
*   `Provider` = "Gemini" or "Inworld"

**Sub-Formulas:**
1.  **Audio Input Tokens** = `D * 60 * 25`
2.  **Text Input Tokens** = `(T_IN * D) + (S * 500)`
3.  **Text Output Tokens** = `(T_OUT * D)`
4.  **Cost_Pre_TTS** = `(Audio Input + Text Input + Text Output) * ($1 / 1,000,000)`
5.  **Cost_Gemini_TTS** = `(D * 60 * 25) * ($20 / 1,000,000)`
6.  **Cost_Inworld_TTS** = `(D * CPM) * ($50 / 1,000,000)`

**Final Consolidated Formula:**

```text
Cost_per_minute = 
  // Base LLM Cost (Transcription, Translation, Logic)
  ( (D * 60 * 25) + (T_IN * D) + (S * 500) + (T_OUT * D) ) * ($1 / 1,000,000)
  
  + // ADD TTS Provider Cost
  IF(selected_TTS_provider == "Gemini", 
     (D * 60 * 25) * ($20 / 1,000,000), 
     (D * CPM) * ($50 / 1,000,000)
  )
```

---

## 3. Credit System Redesign

We replace the flat pricing with a margin-based dynamic rate. 
Assuming a **50% margin**, we double the raw cost to determine the price to the user.
Assume **1 Credit = $0.01**.

**Derived Credit Rates:**
*   **Raw Cost (Gemini-Only):** ~$0.035 / min  => **Price:** $0.07 / min  => **7 Credits / minute**
*   **Raw Cost (Gemini + Inworld):** ~$0.055 / min => **Price:** $0.11 / min => **11 Credits / minute**

**Dynamic Formula:**
```text
Credits = ceil(duration_minutes) * dynamic_rate

Where dynamic_rate is:
- 7  if TTS == "Gemini"
- 11 if TTS == "Inworld"
```
*(You can adjust the base value of 1 credit up or down to tweak these integers, e.g., if 1 credit = $0.005, then rates are 14 and 22).*

---

## 4. Sensitivity Analysis

How do changes in variables affect our cost?

### A. Characters per Minute = 800 vs 1200
Because Gemini TTS is billed on **audio duration** (seconds -> tokens), its cost is completely immune to fast or slow speaking rates. Inworld TTS is billed on **characters**.

*   **At 800 chars/min:**
    *   Inworld TTS Cost: `800 * ($50 / 1M)` = **$0.040 / min** (Decreases)
    *   Gemini TTS Cost: remains **$0.030 / min**
*   **At 1200 chars/min:**
    *   Inworld TTS Cost: `1200 * ($50 / 1M)` = **$0.060 / min** (Increases 20%)
    *   Gemini TTS Cost: remains **$0.030 / min**

### B. Number of Segments Increases
*   **Cost Impact:** Negligible. A 10-minute file cut into 150 segments vs 300 segments produces almost the exact same number of total characters and audio duration. The JSON overhead adds maybe ~500 extra tokens ($0.0005).
*   **System Impact:** High. 300 segments mean 300 parallel API calls to the TTS provider. This will trigger rate limits and cause timeouts.

### C. Multiple Speakers Increase LLM Calls
*   **Cost Impact:** Negligible. The voice matching prompt requires passing speaker descriptions to the LLM. 
*   **Math:** Each additional speaker adds ~500 input tokens. At $1/1M tokens, 10 extra speakers cost **$0.005**. 
*   **Conclusion:** Do not artificially limit speakers to save money.

---

## 5. Optimization Suggestions

Based STRICTLY on this pricing model:

### Where is the biggest cost?
**TTS is overwhelmingly the biggest cost.**
*   In the Gemini-Only pipeline, TTS accounts for **85%** of the cost ($0.030 / $0.035).
*   In the Inworld pipeline, TTS accounts for **91%** of the cost ($0.050 / $0.055).
*   The entire LLM intelligence layer (Transcription + Translation + Voice Match) costs less than half a cent per minute ($0.005).

### How to reduce it?
1.  **Prefer Gemini TTS**: Default users to Gemini TTS, as it is 40% cheaper than Inworld at standard speaking rates (1000 chars/min), and the gap widens if the speaker talks fast (1200+ chars/min).
2.  **Merge Segments (Latency & Rate Limit Fix)**: 
    *   *Should we merge segments?* **Yes.** It does not save direct token cost, but it drastically reduces HTTP overhead, prevents API rate limiting, and lowers system compute time. Group adjacent segments of the same speaker if the gap between them is < 1 second, then slice the resulting audio locally with `ffmpeg`.
3.  **Cache Transcription**:
    *   *Should we cache it?* **Yes, but for UX, not cost.** Caching saves < $0.005 per minute. However, it saves 15-30 seconds of processing time if a user re-runs a failed job or wants to translate the same video to a second language.
4.  **Limit Speakers?**: 
    *   *Should we limit them?* **No.** Extra speakers cost fractions of a penny. Do not degrade the product for negligible savings.
