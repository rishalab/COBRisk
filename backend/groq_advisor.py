"""
groq_advisor.py
───────────────
Calls the Groq LLM API to generate actionable, context-aware
AI suggestions for MEDIUM and HIGH risk COBOL modules.

KEY FIX: Uses `requests` instead of `urllib`.
  urllib sends "Python-urllib/3.x" User-Agent which Cloudflare
  blocks with error 1010. The `requests` library with a proper
  User-Agent header passes Cloudflare cleanly.

The API key is read exclusively from the .env file —
it is NEVER exposed to the frontend.
"""
import os
import json
import re
import requests
from requests.exceptions import HTTPError, Timeout, RequestException
from dotenv import load_dotenv

# Load .env from the same directory as this file
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"

# ── Deprecated aliases → current names ──────────────────────────────────────
_MODEL_ALIASES = {
    "llama3-8b-8192":  "llama-3.1-8b-instant",
    "llama3-70b-8192": "llama-3.3-70b-versatile",
}

# ── Base headers that pass Cloudflare's bot check ───────────────────────────
_BASE_HEADERS = {
    "Content-Type":  "application/json",
    "Accept":        "application/json",
    "User-Agent":    "COBRisk/1.1 (COBOL-Migration-Risk-Analyser)",
    "Cache-Control": "no-cache",
}


def _is_configured() -> bool:
    return bool(GROQ_API_KEY and GROQ_API_KEY != "your_groq_api_key_here")


def _resolve_model(model: str) -> str:
    return _MODEL_ALIASES.get(model, model)


def _build_prompt(module: dict) -> str:
    """Construct a rich, context-aware prompt from the module's metrics.

    The five MRI dimensions (from the COBRisk paper) are:
      1. Coupling Density     — inbound CALLs, SELECT/FD file ops, copybook fan-in
      2. Documentation Deficit — comment ratio, missing headers
      3. Logic Volatility      — GOTO density, paragraph count, control-flow irregularity
      4. Data Complexity       — REDEFINES, COMP-3, EBCDIC fields
      5. Dead Code Ratio       — unreachable paragraphs, dead PERFORMs
    """
    m    = module
    raw  = m["metrics"]["raw"]
    tier = m["tier"]

    return f"""You are a senior COBOL modernization architect with 20+ years of experience.
Analyze the following COBOL module risk report and provide SPECIFIC, ACTIONABLE suggestions.

MODULE: {m['filename']}
RISK TIER: {tier}
MRI SCORE: {m['mri']} / 100

━━━ FIVE MRI DIMENSION SCORES (0–100, higher = riskier) ━━━
• Coupling Density:      {m['metrics']['coupling_density']}
  Signals: inbound CALLs, shared SELECT/FD file ops, copybook fan-in
• Documentation Deficit: {m['metrics']['documentation_deficit']}
  Signals: comment-to-code ratio, missing program headers
• Logic Volatility:      {m['metrics']['logic_volatility']}
  Signals: GOTO density, paragraph count, control-flow irregularity
• Data Complexity:       {m['metrics']['data_complexity']}
  Signals: REDEFINES clauses, COMP-3 packed decimal fields, EBCDIC-encoded fields
• Dead Code Ratio:       {m['metrics']['dead_code_ratio']}
  Signals: unreachable paragraphs, dead PERFORMs

━━━ RAW SIGNAL COUNTS (nine COBRisk signals) ━━━
• Inbound CALL references:       {raw['coupling_in']}
• Outbound CALL/COPY refs:       {raw['coupling_out']}
• File operation verbs (OPEN/READ/WRITE…): {raw['file_ops']}
• Shared SELECT/FD files (cross-module):   {raw.get('shared_file_ops', 0)}
• Comment lines:                 {raw['comment_lines']}  / Code lines: {raw['code_lines']}
• GOTO statements:               {raw['goto_count']}
• Total paragraphs:              {raw['paragraphs']}
• REDEFINES clauses:             {raw['redefines']}
• COMP-3 / packed decimal fields:{raw['comp3']}
• EBCDIC-encoded fields:         {raw.get('ebcdic', 0)}
• Dead (unreachable) paragraphs: {raw['dead_paragraphs']}
• Total lines:                   {m['lines']}

━━━ DIVISIONS PRESENT ━━━
{', '.join(m['divisions']) if m['divisions'] else 'Unknown'}

━━━ PARAGRAPHS (sample, up to 15) ━━━
{', '.join(m['paragraphs'][:15]) if m['paragraphs'] else 'None detected'}

Based on this analysis, respond with a JSON object (no markdown, no extra text) with this EXACT structure:
{{
  "summary": "2-sentence plain English summary of why this module is {tier} risk",
  "top_issues": [
    {{"issue": "short issue title", "detail": "1-2 sentence explanation tied to specific signal counts above"}}
  ],
  "action_plan": [
    {{"priority": "IMMEDIATE|SHORT-TERM|LONG-TERM", "action": "concrete action to take", "impact": "what this fixes"}}
  ],
  "migration_strategy": "paragraph describing the recommended migration approach for this specific module",
  "estimated_effort": "e.g. 2-3 weeks with 2 developers",
  "quick_wins": ["one quick thing", "another quick thing", "third quick thing"]
}}

Rules:
- top_issues: exactly 3 items, focused on the HIGHEST scoring dimensions
- action_plan: exactly 4 items ordered IMMEDIATE → SHORT-TERM → LONG-TERM
- quick_wins: exactly 3 concrete immediate actions (things doable in < 1 day)
- Reference specific signal numbers in your analysis — be SPECIFIC, not generic
- Respond with ONLY the JSON object, nothing else"""


def get_ai_suggestions(module: dict) -> dict:
    """
    Generate AI suggestions for a single MEDIUM or HIGH risk module.
    Returns a dict with suggestions, or a structured error dict if unavailable.
    """
    if not _is_configured():
        return {
            "available": False,
            "reason":    "GROQ_API_KEY not set in backend/.env",
            "fix":       "Open backend/.env and replace 'your_groq_api_key_here' with your real key.",
            "setup_url": "https://console.groq.com/",
        }

    model   = _resolve_model(GROQ_MODEL)
    headers = {**_BASE_HEADERS, "Authorization": f"Bearer {GROQ_API_KEY}"}

    payload = {
        "model": model,
        "messages": [
            {
                "role":    "system",
                "content": (
                    "You are a COBOL modernization expert specializing in migration risk analysis. "
                    "Always respond with valid JSON only — no markdown fences, no preamble."
                ),
            },
            {
                "role":    "user",
                "content": _build_prompt(module),
            },
        ],
        "temperature": 0.4,
        "max_tokens":  1400,
    }

    try:
        resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()

        raw_text = resp.json()["choices"][0]["message"]["content"].strip()

        # Strip markdown fences defensively
        raw_text = re.sub(r"^```json\s*", "", raw_text, flags=re.MULTILINE)
        raw_text = re.sub(r"^```\s*",     "", raw_text, flags=re.MULTILINE)
        raw_text = re.sub(r"\s*```$",     "", raw_text, flags=re.MULTILINE)

        suggestions              = json.loads(raw_text)
        suggestions["available"] = True
        suggestions["model"]     = model
        return suggestions

    except HTTPError as e:
        code = e.response.status_code
        try:
            err_msg = e.response.json().get("error", {}).get("message", e.response.text[:300])
        except Exception:
            err_msg = e.response.text[:300]

        if code == 401:
            return {
                "available":  False,
                "reason":     "Invalid API key (401). Your GROQ_API_KEY in backend/.env is wrong or expired.",
                "fix":        "Get a fresh key at https://console.groq.com/ and update backend/.env",
                "error_code": 401,
            }
        if code == 403:
            return {
                "available":  False,
                "reason":     f"Access denied (403): {err_msg}",
                "fix":        "Ensure your Groq account is active and the key has not been revoked.",
                "setup_url":  "https://console.groq.com/",
                "error_code": 403,
            }
        if code == 404:
            return {
                "available":  False,
                "reason":     f"Model '{model}' not found (404). It may have been renamed or removed.",
                "fix":        "In backend/.env set: GROQ_MODEL=llama-3.1-8b-instant",
                "error_code": 404,
            }
        if code == 429:
            return {
                "available":  False,
                "reason":     "Groq rate limit reached (429). Free tier allows ~30 requests/min.",
                "fix":        "Wait a few seconds and click Regenerate to retry.",
                "error_code": 429,
            }
        return {
            "available":  False,
            "reason":     f"Groq API error {code}: {err_msg}",
            "error_code": code,
        }

    except Timeout:
        return {
            "available": False,
            "reason":    "Request timed out after 30 s. Groq may be under load.",
            "fix":       "Wait a moment and click Regenerate.",
        }

    except json.JSONDecodeError:
        return {
            "available": False,
            "reason":    "AI returned malformed JSON. Try regenerating.",
            "fix":       "This is a transient model formatting issue — click Regenerate to retry.",
        }

    except RequestException as e:
        return {
            "available": False,
            "reason":    f"Network error: {str(e)}",
            "fix":       "Check your internet connection and that the backend can reach api.groq.com",
        }

    except Exception as e:
        return {
            "available": False,
            "reason":    f"Unexpected error: {str(e)}",
        }


def get_batch_suggestions(modules: list) -> dict:
    """
    Generate suggestions for all MEDIUM and HIGH risk modules.
    Returns {filename: suggestions_dict}
    """
    results = {}
    for mod in modules:
        if mod.get("tier") in ("MEDIUM", "HIGH"):
            results[mod["filename"]] = get_ai_suggestions(mod)
    return results
