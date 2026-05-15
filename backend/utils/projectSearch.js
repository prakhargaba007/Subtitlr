const path = require("path");

const MAX_SEARCH_TEXT_LENGTH = 2000;
const MAX_SEARCH_TOKENS = 80;
const MAX_SEARCH_GRAMS = 240;

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values, limit) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function tokenizeSearchText(value) {
  return unique(normalizeSearchText(value).split(" ").filter(Boolean), MAX_SEARCH_TOKENS);
}

function getFileNameWithoutExtension(fileName) {
  const base = path.basename(String(fileName ?? ""));
  const parsed = path.parse(base);
  return parsed.name || base;
}

function buildTrigrams(value) {
  const normalized = normalizeSearchText(value).replace(/\s+/g, "");
  if (!normalized) return [];
  if (normalized.length <= 3) return [normalized];

  const grams = [];
  for (let i = 0; i <= normalized.length - 3; i += 1) {
    grams.push(normalized.slice(i, i + 3));
  }
  return unique(grams, MAX_SEARCH_GRAMS);
}

function collectSearchParts(project, job) {
  const originalFileName = job?.originalFileName ?? "";
  const kindAliases =
    project?.kind === "subtitle"
      ? ["subtitle", "subtitles", "caption", "captions"]
      : project?.kind === "dubbing"
        ? ["dubbing", "dub", "dubbed", "voiceover"]
        : [];
  return [
    project?.displayName,
    originalFileName,
    getFileNameWithoutExtension(originalFileName),
    ...kindAliases,
    job?.fileType,
    job?.status,
    job?.language,
    job?.sourceLanguage,
    job?.targetLanguage,
  ].filter((value) => value != null && String(value).trim());
}

function buildProjectSearchDocument(project, job) {
  const parts = collectSearchParts(project, job);
  const searchText = normalizeSearchText(parts.join(" ")).slice(0, MAX_SEARCH_TEXT_LENGTH);
  const searchTokens = tokenizeSearchText(searchText);
  const searchTrigrams = unique(
    [
      ...buildTrigrams(searchText),
      ...searchTokens.flatMap((token) => buildTrigrams(token)),
    ],
    MAX_SEARCH_GRAMS,
  );

  return {
    searchText,
    searchTokens,
    searchTrigrams,
    searchUpdatedAt: new Date(),
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildProjectSearchFilter(baseFilter, query) {
  const normalized = normalizeSearchText(query);
  const queryTokens = tokenizeSearchText(normalized);
  const queryTrigrams = unique(
    [
      ...buildTrigrams(normalized),
      ...queryTokens.flatMap((token) => buildTrigrams(token)),
    ],
    MAX_SEARCH_GRAMS,
  );

  if (!normalized) return { filter: baseFilter, normalized, queryTokens, queryTrigrams };

  const regexes = queryTokens.slice(0, 5).map((token) => new RegExp(escapeRegex(token), "i"));
  const orClauses = [
    { searchText: { $regex: new RegExp(escapeRegex(normalized), "i") } },
  ];

  if (queryTokens.length) {
    orClauses.push({ searchTokens: { $in: queryTokens } });
  }
  if (queryTrigrams.length) {
    orClauses.push({ searchTrigrams: { $in: queryTrigrams } });
  }
  for (const regex of regexes) {
    orClauses.push({ displayName: { $regex: regex } });
  }

  return {
    filter: { ...baseFilter, $or: orClauses },
    normalized,
    queryTokens,
    queryTrigrams,
  };
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function tokenSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 3) return 0;
  const distance = levenshteinDistance(a, b);
  return Math.max(0, 1 - distance / maxLen);
}

function scoreProjectSearchResult(project, normalizedQuery, queryTokens, queryTrigrams) {
  const text = project.searchText || normalizeSearchText(project.displayName);
  const tokens = Array.isArray(project.searchTokens) ? project.searchTokens : tokenizeSearchText(text);
  const grams = Array.isArray(project.searchTrigrams) ? project.searchTrigrams : buildTrigrams(text);
  let score = 0;

  if (text === normalizedQuery) score += 1000;
  if (text.includes(normalizedQuery)) score += 500;
  if (project.displayName && normalizeSearchText(project.displayName).includes(normalizedQuery)) {
    score += 200;
  }

  for (const queryToken of queryTokens) {
    let best = 0;
    for (const token of tokens) {
      best = Math.max(best, tokenSimilarity(queryToken, token));
      if (best === 1) break;
    }
    score += Math.round(best * 120);
  }

  if (queryTrigrams.length && grams.length) {
    const gramSet = new Set(grams);
    const matches = queryTrigrams.filter((gram) => gramSet.has(gram)).length;
    score += Math.round((matches / queryTrigrams.length) * 160);
  }

  if (project.pinnedAt) score += 25;
  return score;
}

module.exports = {
  normalizeSearchText,
  tokenizeSearchText,
  buildProjectSearchDocument,
  buildProjectSearchFilter,
  scoreProjectSearchResult,
};
