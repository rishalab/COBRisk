from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from analyzer import COBOLAnalyzer
from groq_advisor import get_ai_suggestions, get_batch_suggestions, _is_configured

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ─────────────────────────────────────────────
#  HEALTH CHECK
# ─────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "COBRIS API running",
        "version": "1.1.0",
        "ai_configured": _is_configured(),
    })


# ─────────────────────────────────────────────
#  ANALYZE UPLOADED FILES
# ─────────────────────────────────────────────
@app.route("/api/analyze", methods=["POST"])
def analyze():
    if "files" not in request.files:
        return jsonify({"error": "No files uploaded"}), 400

    files = request.files.getlist("files")
    cobol_sources = {}

    for f in files:
        if f.filename.endswith((".cob", ".cbl", ".cpy", ".CBL", ".COB")):
            content = f.read().decode("utf-8", errors="replace")
            cobol_sources[f.filename] = content

    if not cobol_sources:
        return jsonify({"error": "No valid COBOL files found (.cob, .cbl, .cpy)"}), 400

    analyzer = COBOLAnalyzer(cobol_sources)
    result = analyzer.analyze()
    result["ai_configured"] = _is_configured()
    return jsonify(result)


# ─────────────────────────────────────────────
#  ANALYZE SAMPLE FILES
# ─────────────────────────────────────────────
@app.route("/api/analyze-sample", methods=["GET"])
def analyze_sample():
    sample_dir = os.path.join(os.path.dirname(__file__), "..", "sample_cobol")
    cobol_sources = {}
    for fname in os.listdir(sample_dir):
        if fname.endswith((".cob", ".cbl", ".cpy")):
            with open(os.path.join(sample_dir, fname), "r", errors="replace") as f:
                cobol_sources[fname] = f.read()
    if not cobol_sources:
        return jsonify({"error": "No sample COBOL files found"}), 404
    analyzer = COBOLAnalyzer(cobol_sources)
    result = analyzer.analyze()
    result["ai_configured"] = _is_configured()
    return jsonify(result)


# ─────────────────────────────────────────────
#  AI SUGGESTION — SINGLE MODULE (on-demand)
# ─────────────────────────────────────────────
@app.route("/api/ai-suggest", methods=["POST"])
def ai_suggest():
    data = request.get_json()
    if not data or "module" not in data:
        return jsonify({"error": "Request body must contain 'module' key"}), 400

    module = data["module"]
    tier   = module.get("tier", "LOW")

    if tier == "LOW":
        return jsonify({
            "available": True,
            "skipped":   True,
            "reason":    "This module is LOW risk — no AI suggestions needed.",
        })

    suggestions = get_ai_suggestions(module)
    return jsonify(suggestions)


# ─────────────────────────────────────────────
#  AI SUGGESTIONS — ALL MEDIUM+HIGH (batch)
# ─────────────────────────────────────────────
@app.route("/api/ai-suggest-all", methods=["POST"])
def ai_suggest_all():
    data = request.get_json()
    if not data or "modules" not in data:
        return jsonify({"error": "Request body must contain 'modules' key"}), 400

    modules = data["modules"]
    results = get_batch_suggestions(modules)
    return jsonify({"results": results, "count": len(results)})


# ─────────────────────────────────────────────
#  AI STATUS CHECK
# ─────────────────────────────────────────────
@app.route("/api/ai-status", methods=["GET"])
def ai_status():
    return jsonify({
        "configured": _is_configured(),
        "setup_url":  "https://console.groq.com/",
        "env_file":   "../backend/.env",
        "key_name":   "GROQ_API_KEY",
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
