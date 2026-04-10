#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
import wave
from typing import Any

import numpy as np
import torch
from silero_vad import get_speech_timestamps, load_silero_vad

SR = 16000
_MODEL: Any | None = None
_LOG = logging.getLogger("silero_vad_timeline")


def _configure_logging() -> None:
    h = logging.StreamHandler(sys.stderr)
    h.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
    _LOG.handlers.clear()
    _LOG.addHandler(h)
    _LOG.setLevel(logging.INFO)


def get_vad_model() -> Any:
    global _MODEL
    if _MODEL is None:
        torch.set_num_threads(1)
        torch.set_num_interop_threads(1)
        _MODEL = load_silero_vad()
    return _MODEL


def ffmpeg_to_wav16k_mono(ffmpeg_bin: str, src_path: str, dst_wav: str) -> None:
    cmd = [
        ffmpeg_bin,
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-y",
        "-i",
        src_path,
        "-ac",
        "1",
        "-ar",
        str(SR),
        "-f",
        "wav",
        "-acodec",
        "pcm_s16le",
        dst_wav,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        err = (e.stderr or e.stdout or "").strip() or str(e)
        raise RuntimeError(f"ffmpeg failed: {err}") from e
    if not os.path.isfile(dst_wav) or os.path.getsize(dst_wav) < 64:
        raise RuntimeError("ffmpeg produced empty or invalid WAV")


def pcm_wav_to_tensor(wav_path: str) -> tuple[torch.Tensor, float]:
    with wave.open(wav_path, "rb") as wf:
        ch = wf.getnchannels()
        sw = wf.getsampwidth()
        fr = wf.getframerate()
        n = wf.getnframes()
        if ch != 1 or sw != 2 or fr != SR:
            raise ValueError(f"unexpected WAV format ch={ch} width={sw} rate={fr}")
        raw = wf.readframes(n)
    if not raw:
        return torch.zeros(0, dtype=torch.float32), 0.0
    arr = np.frombuffer(raw, dtype="<i2", count=len(raw) // 2)
    t = torch.from_numpy(arr).to(dtype=torch.float32)
    t.mul_(1.0 / 32768.0)
    duration = float(t.numel()) / SR
    return t, duration


def clamp_segments(
    segs: list[tuple[float, float]], pad_lo: float, pad_hi: float, duration: float
) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for a, b in segs:
        s = max(0.0, a - pad_lo)
        e = min(duration, b + pad_hi)
        if e - s > 1e-6:
            out.append((s, e))
    return out


def merge_close_gaps(segs: list[tuple[float, float]], max_gap: float) -> list[tuple[float, float]]:
    if not segs:
        return []
    segs = sorted(segs, key=lambda x: (x[0], x[1]))
    m = [list(segs[0])]
    for a, b in segs[1:]:
        if a - m[-1][1] <= max_gap:
            m[-1][1] = max(m[-1][1], b)
        else:
            m.append([a, b])
    return [(x[0], x[1]) for x in m]


def drop_short(segs: list[tuple[float, float]], min_dur: float) -> list[tuple[float, float]]:
    return [(a, b) for a, b in segs if b - a >= min_dur]


def merge_overlaps(segs: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not segs:
        return []
    segs = sorted(segs, key=lambda x: (x[0], x[1]))
    out = [[segs[0][0], segs[0][1]]]
    for a, b in segs[1:]:
        if a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return [(x[0], x[1]) for x in out]


def speech_to_intervals(
    speech: list[tuple[float, float]], duration: float
) -> list[dict[str, Any]]:
    intervals: list[dict[str, Any]] = []
    cur = 0.0
    for a, b in speech:
        if a > cur + 1e-6:
            intervals.append({"type": "silence", "start": cur, "end": a})
        intervals.append({"type": "speech", "start": a, "end": b})
        cur = max(cur, b)
    if cur < duration - 1e-6:
        intervals.append({"type": "silence", "start": cur, "end": duration})
    return intervals


def summarize(intervals: list[dict[str, Any]], duration: float) -> dict[str, float | int]:
    sp = sum(x["end"] - x["start"] for x in intervals if x["type"] == "speech")
    si = sum(x["end"] - x["start"] for x in intervals if x["type"] == "silence")
    nsp = sum(1 for x in intervals if x["type"] == "speech")
    return {
        "totalSpeechSec": round(sp, 4),
        "totalSilenceSec": round(si, 4),
        "speechSegmentCount": nsp,
        "durationSec": round(duration, 4),
    }


def run_pipeline_on_wav_tensor(
    wav: torch.Tensor,
    duration: float,
    *,
    threshold: float,
    min_speech_ms: int,
    min_silence_ms: int,
    speech_pad_ms: int,
    neg_threshold: float | None,
    merge_gap_sec: float,
    min_output_speech_sec: float,
    extra_pad_sec: float,
) -> dict[str, Any]:
    if wav.numel() == 0 or duration <= 0:
        return {
            "sampleRate": SR,
            "duration": 0.0,
            "intervals": [],
            "meta": {
                "totalSpeechSec": 0.0,
                "totalSilenceSec": 0.0,
                "speechSegmentCount": 0,
                "durationSec": 0.0,
            },
        }

    model = get_vad_model()
    ts_kw: dict[str, Any] = {
        "threshold": threshold,
        "sampling_rate": SR,
        "min_speech_duration_ms": min_speech_ms,
        "min_silence_duration_ms": min_silence_ms,
        "speech_pad_ms": speech_pad_ms,
        "return_seconds": True,
    }
    if neg_threshold is not None:
        ts_kw["neg_threshold"] = neg_threshold
    ts = get_speech_timestamps(wav, model, **ts_kw)
    raw = [(float(t["start"]), float(t["end"])) for t in ts]
    raw = merge_overlaps(raw)
    raw = clamp_segments(raw, extra_pad_sec, extra_pad_sec, duration)
    raw = merge_close_gaps(raw, merge_gap_sec)
    raw = drop_short(raw, min_output_speech_sec)
    raw = merge_overlaps(raw)

    if not raw:
        iv = [{"type": "silence", "start": 0.0, "end": duration}] if duration > 0 else []
        return {
            "sampleRate": SR,
            "duration": duration,
            "intervals": iv,
            "meta": summarize(iv, duration),
        }

    iv = speech_to_intervals(raw, duration)
    return {
        "sampleRate": SR,
        "duration": duration,
        "intervals": iv,
        "meta": summarize(iv, duration),
    }


def process_file(
    input_path: str,
    work_dir: str,
    ffmpeg_bin: str,
    cfg: dict[str, Any],
) -> dict[str, Any]:
    os.makedirs(work_dir, exist_ok=True)
    tmp_wav = os.path.join(work_dir, f"vad_{uuid.uuid4().hex}.wav")
    try:
        ffmpeg_to_wav16k_mono(ffmpeg_bin, input_path, tmp_wav)
        wav, duration = pcm_wav_to_tensor(tmp_wav)
        with torch.inference_mode():
            return run_pipeline_on_wav_tensor(wav, duration, **cfg)
    finally:
        try:
            os.unlink(tmp_wav)
        except OSError:
            pass


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Silero VAD → JSON timeline (stdout)")
    p.add_argument(
        "inputs",
        nargs="+",
        help="Audio/video file(s); any format ffmpeg decodes",
    )
    p.add_argument(
        "--work-dir",
        default="",
        help="Writable directory for temp WAV (default: system temp)",
    )
    p.add_argument(
        "--ffmpeg",
        default="",
        help="ffmpeg binary path (default: FFMPEG_BINARY env or 'ffmpeg')",
    )
    p.add_argument("--threshold", type=float, default=0.45)
    p.add_argument("--min-speech-ms", type=int, default=300)
    p.add_argument("--min-silence-ms", type=int, default=200)
    p.add_argument(
        "--speech-pad-ms",
        type=int,
        default=100,
        help="Padding inside Silero get_speech_timestamps",
    )
    p.add_argument(
        "--neg-threshold",
        type=float,
        default=None,
        help="Hysteresis exit threshold (default: Silero uses threshold - 0.15)",
    )
    p.add_argument("--merge-gap-ms", type=int, default=200)
    p.add_argument(
        "--min-output-speech-ms",
        type=int,
        default=200,
        help="Drop merged speech shorter than this",
    )
    p.add_argument(
        "--extra-pad-ms",
        type=int,
        default=40,
        help="Extra padding before/after each speech block (seconds timeline)",
    )
    return p.parse_args(argv)


def cfg_from_args(ns: argparse.Namespace) -> dict[str, Any]:
    return {
        "threshold": ns.threshold,
        "min_speech_ms": ns.min_speech_ms,
        "min_silence_ms": ns.min_silence_ms,
        "speech_pad_ms": ns.speech_pad_ms,
        "neg_threshold": ns.neg_threshold,
        "merge_gap_sec": ns.merge_gap_ms / 1000.0,
        "min_output_speech_sec": ns.min_output_speech_ms / 1000.0,
        "extra_pad_sec": ns.extra_pad_ms / 1000.0,
    }


def main(argv: list[str] | None = None) -> int:
    _configure_logging()
    ns = parse_args(argv)
    ffmpeg_bin = ns.ffmpeg or os.environ.get("FFMPEG_BINARY") or shutil.which("ffmpeg") or "ffmpeg"
    if not (os.path.isfile(ffmpeg_bin) or shutil.which(ffmpeg_bin)):
        _LOG.error("ffmpeg not found; set --ffmpeg or FFMPEG_BINARY")
        return 1

    cfg = cfg_from_args(ns)
    paths = ns.inputs
    user_work = bool(ns.work_dir.strip())
    base_work = ns.work_dir.strip() or tempfile.mkdtemp(prefix="silero_vad_")

    try:
        outs: list[dict[str, Any]] = []
        for i, inp in enumerate(paths):
            if not os.path.isfile(inp):
                raise FileNotFoundError(f"not a file: {inp}")
            wd = base_work
            if len(paths) > 1:
                wd = os.path.join(base_work, f"job_{i}_{uuid.uuid4().hex}")
                os.makedirs(wd, exist_ok=True)
            outs.append(process_file(inp, wd, ffmpeg_bin, cfg))

        if len(outs) == 1:
            print(json.dumps(outs[0], separators=(",", ":")), flush=True)
        else:
            print(json.dumps(outs, separators=(",", ":")), flush=True)
        return 0
    except Exception as e:
        _LOG.error("%s", e, exc_info=False)
        return 1
    finally:
        if not user_work and os.path.isdir(base_work):
            shutil.rmtree(base_work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
