/**
 * Gemini-powered ATS scoring service.
 *
 * Replaces deterministic keyword matching with a structured Gemini analysis
 * that produces every field shown on the ATS results screen:
 *
 *   overallScore, keywordCoverage, matchedKeywords, missingKeywords,
 *   sectionScores, sectionFixes, strengthsToEmphasize,
 *   recommendedChanges, missingSkills, bulletExample
 */

const { GoogleGenAI } = require("@google/genai");

const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
});

// ─── prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior ATS (Applicant Tracking System) expert and resume coach.
You will receive a candidate's profile and a job description. Analyze them and return a single JSON object — nothing else, no markdown fences.

Return exactly this structure (all fields required):
{
  "overallScore": <number 0–100>,
  "keywordCoverage": <number 0–100, % of JD keywords present anywhere in the profile>,
  "matchedKeywords": [<strings: keywords/phrases from JD found in profile, max 20>],
  "missingKeywords": [<strings: important JD keywords NOT found in profile, max 15>],
  "sectionScores": {
    "skills": <0–100>,
    "experience": <0–100>,
    "projects": <0–100>,
    "education": <0–100>,
    "certifications": <0–100>
  },
  "sectionFixes": {
    "experience": [<1–3 specific, actionable fix strings for the experience section>],
    "skills": [<1–3 specific, actionable fix strings for the skills section>],
    "projects": [<0–2 fix strings, or empty array if section is strong>],
    "education": [<0–1 fix strings, usually empty>],
    "certifications": [<0–2 fix strings>]
  },
  "strengthsToEmphasize": [<3–5 specific strengths from the actual profile>],
  "recommendedChanges": [<3–5 concrete improvements the candidate should make>],
  "missingSkills": [<3–6 skills the candidate should learn to be competitive for this role>],
  "bulletExample": {
    "before": "<a real weak/generic bullet from the candidate's experience or projects>",
    "after": "<AI-rewritten version with metrics, keywords, and impact — targeting 95+ ATS score>"
  }
}

Scoring guide:
- overallScore: holistic match considering skills relevance, experience depth, keyword density, and overall fit
- sectionScores: judge each section independently (skills list vs JD requirements, experience relevance, project fit, education fit, cert relevance)
- keywordCoverage: what % of the important JD keywords and phrases appear anywhere in the profile
- matchedKeywords: exact or semantically close terms from JD that appear in profile
- missingKeywords: JD terms completely absent from profile (prioritise must-have skills and tools)
- bulletExample.before: pick the MOST GENERIC or WEAKEST bullet from the actual experience/project descriptions
- bulletExample.after: rewrite it to be specific, metric-driven, and rich with JD-relevant keywords

Be honest and precise. Do NOT inflate scores. Do NOT return markdown. Return pure JSON only.`;

// ─── profile serialiser ───────────────────────────────────────────────────────

function buildProfileSummary(profile) {
  const lines = [];

  // Skills
  if (profile.skills?.length) {
    lines.push("SKILLS:");
    lines.push(profile.skills.map((s) => `${s.name}${s.proficiency ? ` (${s.proficiency})` : ""}`).join(", "));
  }

  // Experience
  if (profile.experience?.length) {
    lines.push("\nEXPERIENCE:");
    for (const e of profile.experience) {
      lines.push(`- ${e.role} at ${e.company}${e.isCurrent ? " (current)" : ""}`);
      if (e.techUsed?.length) lines.push(`  Tech: ${e.techUsed.join(", ")}`);
      if (Array.isArray(e.description) && e.description.length) {
        for (const d of e.description.slice(0, 5)) lines.push(`  • ${d}`);
      }
    }
  }

  // Projects
  if (profile.projects?.length) {
    lines.push("\nPROJECTS:");
    for (const p of profile.projects) {
      lines.push(`- ${p.name}`);
      if (p.skills?.length) lines.push(`  Skills: ${p.skills.join(", ")}`);
      if (Array.isArray(p.description) && p.description.length) {
        for (const d of p.description.slice(0, 4)) lines.push(`  • ${d}`);
      }
    }
  }

  // Education
  if (profile.education?.length) {
    lines.push("\nEDUCATION:");
    for (const e of profile.education) {
      lines.push(`- ${e.title}${e.institution ? ` — ${e.institution}` : ""}${e.level ? ` (${e.level})` : ""}`);
    }
  }

  // Certifications
  if (profile.certifications?.length) {
    lines.push("\nCERTIFICATIONS:");
    for (const c of profile.certifications) {
      lines.push(`- ${c.name}${c.issuer ? ` (${c.issuer})` : ""}`);
    }
  }

  return lines.join("\n");
}

// ─── response parser ──────────────────────────────────────────────────────────

function parseGeminiResponse(response) {
  let text = "";

  if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = response.candidates[0].content.parts[0].text;
  } else if (typeof response.text === "string") {
    text = response.text;
  } else if (typeof response.response?.text === "function") {
    text = response.response.text();
  } else if (typeof response.response?.text === "string") {
    text = response.response.text;
  } else {
    throw new Error("Unexpected Gemini response format");
  }

  // Strip markdown fences if present
  const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return JSON.parse(clean);
}

// ─── safe defaults ────────────────────────────────────────────────────────────

function safeAts(partial) {
  return {
    overallScore: Number(partial.overallScore) || 0,
    keywordCoverage: Number(partial.keywordCoverage) || 0,
    matchedKeywords: Array.isArray(partial.matchedKeywords) ? partial.matchedKeywords : [],
    missingKeywords: Array.isArray(partial.missingKeywords) ? partial.missingKeywords : [],
    sectionScores: {
      skills: Number(partial.sectionScores?.skills) || 0,
      experience: Number(partial.sectionScores?.experience) || 0,
      projects: Number(partial.sectionScores?.projects) || 0,
      education: Number(partial.sectionScores?.education) || 0,
      certifications: Number(partial.sectionScores?.certifications) || 0,
    },
    sectionFixes: {
      experience: partial.sectionFixes?.experience || [],
      skills: partial.sectionFixes?.skills || [],
      projects: partial.sectionFixes?.projects || [],
      education: partial.sectionFixes?.education || [],
      certifications: partial.sectionFixes?.certifications || [],
    },
    strengthsToEmphasize: Array.isArray(partial.strengthsToEmphasize) ? partial.strengthsToEmphasize : [],
    recommendedChanges: Array.isArray(partial.recommendedChanges) ? partial.recommendedChanges : [],
    missingSkills: Array.isArray(partial.missingSkills) ? partial.missingSkills : [],
    bulletExample: {
      before: partial.bulletExample?.before || "",
      after: partial.bulletExample?.after || "",
    },
    lastAnalyzedAt: new Date(),
  };
}

// ─── main export ─────────────────────────────────────────────────────────────

/**
 * Score a candidate's profile against a job description using Gemini.
 *
 * @param {Object} profile        - Mongoose Profile document
 * @param {Object} jobDescription - Mongoose JobDescription document
 * @returns {Promise<Object>}     - Full ats block ready to save to TailoredResume
 */
async function scoreProfile(profile, jobDescription) {
  const profileSummary = buildProfileSummary(profile);
  // Truncate JD to avoid token bloat
  const jdText = (jobDescription.content || "").slice(0, 4000);

  let userPrompt;
  if (!jdText || jdText.trim() === "") {
    userPrompt = `CANDIDATE PROFILE:\n${profileSummary}`;
  } else {
    userPrompt = `JOB DESCRIPTION:\n${jdText}\n\n---\n\nCANDIDATE PROFILE:\n${profileSummary}`;
  }


  const start = Date.now();
  console.log("[ATS Scorer] Calling Gemini for ATS analysis…");
  let model = "gemini-3.1-flash-lite-preview";

  const response = await gemini.models.generateContent({
    model: model,
    contents: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  console.log(`[ATS Scorer] Gemini ${model} responded in ${Date.now() - start}ms`);

  const parsed = parseGeminiResponse(response);
  return safeAts(parsed);
}

module.exports = { scoreProfile };
