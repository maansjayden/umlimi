"""Pre-generate the fixed answer clips with ElevenLabs. Run once at build time; the phone only plays MP3s offline.

Reads the answer texts from app/src/content.ts, picks for each language the first ElevenLabs model that lists it,
and writes app/public/audio/<lang>/<key>.mp3 (low-bitrate mono, ~10-20 KB each).
Env: ELEVENLABS_API_KEY (sk_...), optional ELEVENLABS_VOICE_ID.
"""
import os
import re
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "app" / "src" / "content.ts"
OUT = ROOT / "app" / "public" / "audio"
API = "https://api.elevenlabs.io/v1"
# newest first; the first one that supports the language wins
MODEL_PREFERENCE = ["eleven_v4", "eleven_v3", "eleven_v4_turbo", "eleven_multilingual_v2", "eleven_flash_v2_5"]
LANGS = ["af", "zu", "en"]
KEY = os.environ["ELEVENLABS_API_KEY"]
H = {"xi-api-key": KEY}


def answers() -> dict[str, dict[str, str]]:
    """Pull `advice: { af: '...', zu: '...', en: '...' }` per answer key out of content.ts."""
    src = CONTENT.read_text().split("export const UI")[0]
    out = {}
    for m in re.finditer(r"^  (\w+): \{\n(.*?)\n  \},", src, flags=re.S | re.M):
        advice = re.search(r"advice: \{(.*?)\n    \}", m.group(2), flags=re.S).group(1)
        out[m.group(1)] = {
            lang: re.search(rf"{lang}: (['\"])(.*?)\1,", advice, flags=re.S).group(2).replace("\\'", "'")
            for lang in LANGS
        }
    return out


def model_for(lang: str) -> str:
    models = requests.get(f"{API}/models", headers=H, timeout=30).json()
    support = {m["model_id"]: {l["language_id"] for l in m.get("languages", [])} for m in models}
    for mid in MODEL_PREFERENCE:
        if lang in support.get(mid, set()):
            return mid
    sys.exit(f"no ElevenLabs model lists language '{lang}'. Available: {sorted(support)}")


def voice_id() -> str:
    if v := os.environ.get("ELEVENLABS_VOICE_ID"):
        return v
    voices = requests.get(f"{API}/voices", headers=H, timeout=30).json()["voices"]
    by_name = {v["name"].split(" ")[0]: v["voice_id"] for v in voices}
    return by_name.get("Sarah") or voices[0]["voice_id"]  # calm, clear premade voice


def main():
    texts = answers()
    assert len(texts) == 7, f"expected 7 answers, parsed {sorted(texts)}"
    vid = voice_id()
    for lang in LANGS:
        model = model_for(lang)
        print(f"{lang}: {model}")
        for key, t in texts.items():
            dst = OUT / lang / f"{key}.mp3"
            dst.parent.mkdir(parents=True, exist_ok=True)
            r = requests.post(
                f"{API}/text-to-speech/{vid}",
                params={"output_format": "mp3_22050_32"},
                headers=H,
                json={"text": t[lang], "model_id": model, "language_code": lang},
                timeout=120,
            )
            if r.status_code == 400 and "language_code" in r.text:  # some models infer language themselves
                r = requests.post(f"{API}/text-to-speech/{vid}", params={"output_format": "mp3_22050_32"},
                                  headers=H, json={"text": t[lang], "model_id": model}, timeout=120)
            r.raise_for_status()
            dst.write_bytes(r.content)
            print(f"  {key}: {len(r.content) // 1024} KB")


if __name__ == "__main__":
    main()
