#!/usr/bin/env python3
"""Vision direct wrapper - bypasses Hermes broken vision client."""
import base64
import httpx
import os

def _get_api_key():
    env_key = os.environ.get("KIMI_API_KEY", "")
    if env_key:
        return env_key
    # Fallback: read from ~/.hermes/.env
    env_path = os.path.expanduser("~/.hermes/.env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("KIMI_API_KEY="):
                    return line.split("=", 1)[1].strip()
    return ""

API_KEY = _get_api_key()
BASE_URL = "https://api.moonshot.ai/v1"
MODEL = "kimi-k2.6"

def analyze_image(image_path: str, question: str, timeout: float = 120.0) -> str:
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    mime = "image/jpeg" if image_path.lower().endswith(".jpg") or image_path.lower().endswith(".jpeg") else "image/png"
    resp = httpx.post(
        f"{BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": question},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}}
                ]
            }]
        },
        timeout=timeout
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]

if __name__ == "__main__":
    import sys
    path = sys.argv[1]
    question = sys.argv[2] if len(sys.argv) > 2 else "Describe this image."
    print(analyze_image(path, question))
