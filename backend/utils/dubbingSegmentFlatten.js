/**
 * Expand translated segments into timed TTS rows (parent segments may contain subSegments).
 *
 * @param {Array<{start:number,end:number,speaker_id:string,translatedText:string,subSegments?:Array<{relStart:number,relEnd:number,translatedText:string}>}>} segments
 * @returns {Array<{parentIndex:number,subIndex:number,start:number,end:number,speaker_id:string,text:string,relStart:number,relEnd:number}>}
 */
const flattenTranslatedSegmentsForTts = (segments) => {
  const rows = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const slot = Math.max(0.05, seg.end - seg.start);
    const subs = Array.isArray(seg.subSegments) && seg.subSegments.length > 0 ? seg.subSegments : null;

    if (subs) {
      for (let j = 0; j < subs.length; j++) {
        const sub = subs[j];
        const rs = Math.max(0, Math.min(1, Number(sub.relStart) || 0));
        const re = Math.max(rs + 0.02, Math.min(1, Number(sub.relEnd) || 1));
        rows.push({
          parentIndex: i,
          subIndex: j,
          start: seg.start + rs * slot,
          end: seg.start + re * slot,
          speaker_id: seg.speaker_id,
          text: String(sub.translatedText || "").trim(),
          relStart: rs,
          relEnd: re,
        });
      }
    } else {
      rows.push({
        parentIndex: i,
        subIndex: -1,
        start: seg.start,
        end: seg.end,
        speaker_id: seg.speaker_id,
        text: String(seg.translatedText || "").trim(),
        relStart: 0,
        relEnd: 1,
      });
    }
  }
  return rows.filter((r) => r.text);
};

/**
 * Flatten a persisted job segment (Mongoose subdoc or plain object) for rebuild.
 */
const flattenJobSegmentForTts = (seg) => {
  const start = Number(seg.start) || 0;
  const end = Number(seg.end) || 0;
  const slot = Math.max(0.05, end - start);
  const subs = Array.isArray(seg.subSegments) && seg.subSegments.length > 0 ? seg.subSegments : null;
  const rows = [];

  if (subs) {
    for (let j = 0; j < subs.length; j++) {
      const sub = subs[j];
      const rs = Math.max(0, Math.min(1, Number(sub.relStart) || 0));
      const re = Math.max(rs + 0.02, Math.min(1, Number(sub.relEnd) || 1));
      rows.push({
        subIndex: j,
        start: start + rs * slot,
        end: start + re * slot,
        speaker_id: seg.speaker_id,
        text: String(sub.translatedText || "").trim(),
      });
    }
  } else {
    rows.push({
      subIndex: -1,
      start,
      end,
      speaker_id: seg.speaker_id,
      text: String(seg.translatedText || "").trim(),
    });
  }
  return rows.filter((r) => r.text);
};

module.exports = {
  flattenTranslatedSegmentsForTts,
  flattenJobSegmentForTts,
};
