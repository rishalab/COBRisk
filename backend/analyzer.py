"""
analyzer.py
───────────
COBRisk static analyser — extracts nine COBOL-specific signals,
computes five MRI dimensions, and classifies each module into
LOW / MEDIUM / HIGH migration risk tiers.

Nine signals (COBRisk paper §3):
  1.  Inbound CALL fan-in           → Coupling Density
  2.  Outbound CALL / COPY refs     → Coupling Density
  3.  Shared SELECT / FD file ops   → Coupling Density
  4.  Comment-to-code ratio         → Documentation Deficit
  5.  GOTO density                  → Logic Volatility
  6.  Paragraph count               → Logic Volatility
  7.  REDEFINES clauses             → Data Complexity
  8.  COMP-3 / packed decimal       → Data Complexity
  9.  EBCDIC-encoded fields         → Data Complexity
  (+) Dead / unreachable paragraphs → Dead Code Ratio

Five MRI dimensions and weights (COBRisk paper §3):
  Coupling Density      30 %
  Documentation Deficit 20 %
  Logic Volatility      20 %
  Data Complexity       20 %
  Dead Code Ratio       10 %

Three-tier classification:
  MRI < 35  → LOW    (migrate now)
  MRI 35–60 → MEDIUM (refactor before migrating)
  MRI > 60  → HIGH   (defer — wrap-and-modernise)

Formula note (§6): The choice between weighted arithmetic mean,
geometric mean, and conjunctive aggregation is acknowledged as an
open methodological question. Weights are from practitioner
heuristics and will be empirically validated in the follow-on study.
"""
import os
import re
from collections import defaultdict


# ── MRI weights — must match MRI_WEIGHTS in ModuleDetail.js ─────────────────
MRI_WEIGHTS = {
    "coupling_density":      0.30,
    "documentation_deficit": 0.20,
    "logic_volatility":      0.20,
    "data_complexity":       0.20,
    "dead_code_ratio":       0.10,
}

# ── Three-tier thresholds — must match TIER_THRESHOLDS in ModuleDetail.js ───
TIER_LOW    = 35
TIER_HIGH   = 60


class COBOLAnalyzer:
    def __init__(self, sources: dict):
        self.sources = sources   # {filename: content}
        self.modules = {}        # parsed module data

    # ─────────────────────────────────────────────
    #  PUBLIC ENTRY
    # ─────────────────────────────────────────────
    def analyze(self):
        # Step 1 — parse every module independently
        for filename, content in self.sources.items():
            self.modules[filename] = self._parse_module(filename, content)

        # Step 2 — cross-module coupling (inbound CALLs + shared file ops)
        self._compute_coupling()
        self._compute_shared_file_ops()

        # Step 3 — score, classify, recommend
        results = []
        for filename, mod in self.modules.items():
            metrics = self._compute_metrics(mod)
            mri     = self._compute_mri(metrics)
            tier    = self._classify(mri)
            results.append({
                "filename":       filename,
                "metrics":        metrics,
                "mri":            round(mri, 2),
                "tier":           tier,
                "paragraphs":     mod["paragraphs"],
                "divisions":      mod["divisions"],
                "lines":          mod["lines"],
                "recommendation": self._recommend(tier, metrics),
            })

        results.sort(key=lambda x: x["mri"], reverse=True)

        return {
            "modules":          results,
            "dependency_graph": self._build_graph(),
            "summary":          self._build_summary(results),
        }

    # ─────────────────────────────────────────────
    #  PARSING — extract all nine raw signals
    # ─────────────────────────────────────────────
    def _parse_module(self, filename, content):
        lines = content.splitlines()
        total_lines = len(lines)

        # ── Comment vs code lines ────────────────
        # COBOL fixed format: column 7 = '*' or '/' means comment
        comment_lines = sum(
            1 for l in lines
            if len(l) >= 7 and l[6] in ("*", "/")
        )
        code_lines = sum(
            1 for l in lines
            if l.strip() and not (len(l) >= 7 and l[6] in ("*", "/"))
        )

        # ── Division detection ───────────────────
        divisions = []
        for div in ["IDENTIFICATION", "ENVIRONMENT", "DATA", "PROCEDURE"]:
            if re.search(rf"\b{div}\s+DIVISION\b", content, re.IGNORECASE):
                divisions.append(div)

        # ── Paragraph detection ──────────────────
        # Fixed-format COBOL: paragraph names start at column 8 (index 7)
        # Pattern: line starts with 6–7 spaces then an identifier then '.'
        raw_paragraphs = re.findall(
            r"^[ \t]{6,7}([A-Z0-9][A-Z0-9\-]*)\s*\.",
            content,
            re.MULTILINE | re.IGNORECASE,
        )
        # Filter out division / section keywords that match the pattern
        _RESERVED = {
            "IDENTIFICATION", "ENVIRONMENT", "DATA", "PROCEDURE",
            "WORKING-STORAGE", "FILE", "LINKAGE", "CONFIGURATION",
            "INPUT-OUTPUT", "FILE-CONTROL", "LOCAL-STORAGE",
            "REPORT", "SCREEN",
        }
        paragraphs = [p.upper() for p in raw_paragraphs
                      if p.upper() not in _RESERVED]

        # ── PERFORM statements (internal paragraph calls) ────────────────
        performs = [p.upper() for p in
                    re.findall(r"\bPERFORM\s+([A-Z0-9][A-Z0-9\-]*)", content, re.IGNORECASE)]

        # ── External CALLs ───────────────────────
        calls = [c.upper() for c in
                 re.findall(r"\bCALL\s+['\"]?([A-Z0-9][A-Z0-9\-]*)['\"]?", content, re.IGNORECASE)]

        # ── COPY / copybook references ───────────
        copies = [c.upper() for c in
                  re.findall(r"\bCOPY\s+([A-Z0-9][A-Z0-9\-]*)", content, re.IGNORECASE)]

        # ── File operations (SELECT / FD + verbs) ───
        # Named file references via SELECT
        select_files = re.findall(r"\bSELECT\s+([A-Z0-9][A-Z0-9\-]*)", content, re.IGNORECASE)
        fd_files     = re.findall(r"\bFD\s+([A-Z0-9][A-Z0-9\-]*)", content, re.IGNORECASE)
        file_verbs   = re.findall(
            r"\b(OPEN|CLOSE|READ|WRITE|REWRITE|DELETE|START)\b",
            content, re.IGNORECASE,
        )

        # ── Data complexity signals ──────────────
        pic_clauses = re.findall(
            r"\bPIC\w*\s+([X9A()\-V\.SZPB+\$\*]+)", content, re.IGNORECASE
        )
        redefines = len(re.findall(r"\bREDEFINES\b", content, re.IGNORECASE))
        comp3     = len(re.findall(r"\bCOMP-3\b|\bPACKED-DECIMAL\b", content, re.IGNORECASE))

        # Signal 9 — EBCDIC-encoded fields:
        #   Explicit EBCDIC keyword, or PIC fields used with DISPLAY / NATIVE
        #   encoding clauses, or explicit encoding literals.
        ebcdic = len(re.findall(
            r"\bEBCDIC\b"                          # explicit EBCDIC keyword
            r"|\bCODE-SET\s+IS\s+EBCDIC\b"         # COBOL encoding clause
            r"|\bCHARACTER\s+TYPE\b"               # IBM z/OS character type
            r"|\bNATIONAL\b"                        # NATIONAL (Unicode/EBCDIC bridge)
            r"|\bNCHAR\b"                           # national char
            r"|\bCOMP-1\b|\bCOMP-2\b",             # COMP-1/2 = IBM floating point (EBCDIC-platform)
            content, re.IGNORECASE,
        ))

        # ── GOTO (spaghetti anti-pattern) ────────
        goto_count = len(re.findall(r"\bGO\s+TO\b", content, re.IGNORECASE))

        # ── Dead paragraph detection ─────────────
        # A paragraph is "dead" if it is never PERFORMed AND never directly
        # branched to via ALTER/GO TO.
        # Exception: the FIRST paragraph is the program entry point —
        # it runs implicitly and must never be flagged as dead.
        goto_targets = set(
            t.upper() for t in
            re.findall(r"\bGO\s+TO\s+([A-Z0-9][A-Z0-9\-]*)", content, re.IGNORECASE)
        )
        alter_targets = set(
            t.upper() for t in
            re.findall(r"\bALTER\s+[A-Z0-9\-]+\s+TO\s+(?:PROCEED\s+TO\s+)?([A-Z0-9][A-Z0-9\-]*)",
                       content, re.IGNORECASE)
        )
        reachable = set(performs) | goto_targets | alter_targets

        defined_set = set(paragraphs)
        # Entry point: first paragraph is always reachable
        entry_point = paragraphs[0] if paragraphs else None
        if entry_point:
            reachable.add(entry_point)

        dead_paragraphs = list(defined_set - reachable)
        dead_ratio      = len(dead_paragraphs) / max(len(defined_set), 1)

        return {
            "filename":        filename,
            "content":         content,
            "lines":           total_lines,
            "code_lines":      code_lines,
            "comment_lines":   comment_lines,
            "divisions":       divisions,
            "paragraphs":      paragraphs[:30],       # cap for UI display
            "performs":        performs,
            "calls":           calls,
            "copies":          copies,
            "select_files":    [f.upper() for f in select_files],
            "fd_files":        [f.upper() for f in fd_files],
            "file_verbs":      file_verbs,
            "file_ops":        len(file_verbs),       # raw verb count
            "shared_file_ops": 0,                     # filled by _compute_shared_file_ops
            "pic_clauses":     len(pic_clauses),
            "redefines":       redefines,
            "comp3":           comp3,
            "ebcdic":          ebcdic,                # Signal 9 — now populated
            "dead_paragraphs": dead_paragraphs,
            "dead_ratio":      dead_ratio,
            "goto_count":      goto_count,
            "coupling_in":     0,                     # filled by _compute_coupling
            "coupling_out":    len(calls) + len(copies),
        }

    # ─────────────────────────────────────────────
    #  COUPLING — inbound CALL / COPY fan-in
    # ─────────────────────────────────────────────
    def _compute_coupling(self):
        """
        For each module, count how many other modules CALL or COPY it.
        This is the blast-radius metric: high inbound fan-in means many
        programs will break if this one changes.
        """
        # Map bare program name (without extension) → full filename
        name_map = {
            os.path.splitext(f)[0].upper(): f
            for f in self.modules
        }

        for src_file, mod in self.modules.items():
            for ref in mod["calls"] + mod["copies"]:
                target = name_map.get(ref.upper())
                if target and target != src_file:
                    self.modules[target]["coupling_in"] += 1

    # ─────────────────────────────────────────────
    #  SHARED FILE OPS — cross-module SELECT/FD
    # ─────────────────────────────────────────────
    def _compute_shared_file_ops(self):
        """
        Count how many modules share the same SELECT/FD file names.
        A file referenced by more than one module is a hidden coupling
        point invisible to generic static analysers (e.g. SonarQube).
        The signal is added to each involved module's shared_file_ops count.
        """
        file_users = defaultdict(set)   # file_name → {filenames that use it}

        for filename, mod in self.modules.items():
            for f in mod["select_files"] + mod["fd_files"]:
                file_users[f].add(filename)

        for filename, mod in self.modules.items():
            shared = sum(
                1 for f in (mod["select_files"] + mod["fd_files"])
                if len(file_users.get(f, set())) > 1
            )
            self.modules[filename]["shared_file_ops"] = shared

    # ─────────────────────────────────────────────
    #  METRICS — normalise signals to 0–100
    # ─────────────────────────────────────────────
    def _compute_metrics(self, mod):
        """
        Each of the five dimensions is normalised to 0–100.
        Higher = riskier in all cases.
        """
        # 1. Coupling Density
        #    Combines inbound fan-in, outbound refs, file verb ops,
        #    and shared file ops (cross-module file coupling).
        total_coupling = (
            mod["coupling_in"] * 3       # inbound weighted more (blast radius)
            + mod["coupling_out"]
            + mod["file_ops"]
            + mod["shared_file_ops"] * 2 # shared files = hidden coupling
        )
        coupling_score = min(total_coupling * 6, 100)

        # 2. Documentation Deficit
        #    Low comment ratio → high deficit → high score
        doc_ratio  = mod["comment_lines"] / max(mod["code_lines"], 1)
        doc_score  = max(0, 100 - int(doc_ratio * 200))

        # 3. Logic Volatility
        #    GOTO density + paragraph count proxy for control-flow complexity
        volatility_score = min(
            mod["goto_count"] * 15 + len(mod["paragraphs"]) * 2,
            100,
        )

        # 4. Data Complexity
        #    REDEFINES + COMP-3 + EBCDIC + PIC clause density
        data_score = min(
            mod["redefines"]    * 10
            + mod["comp3"]      * 8
            + mod["ebcdic"]     * 12    # Signal 9 — now contributing
            + mod["pic_clauses"] // 3,
            100,
        )

        # 5. Dead Code Ratio
        dead_score = int(mod["dead_ratio"] * 100)

        return {
            "coupling_density":      round(coupling_score, 1),
            "documentation_deficit": round(doc_score, 1),
            "logic_volatility":      round(volatility_score, 1),
            "data_complexity":       round(data_score, 1),
            "dead_code_ratio":       round(dead_score, 1),
            # ── Raw signal counts exposed to the frontend ──
            # These must include ALL nine signals so ModuleDetail
            # and the AI prompt can reference them correctly.
            "raw": {
                "coupling_in":    mod["coupling_in"],
                "coupling_out":   mod["coupling_out"],
                "file_ops":       mod["file_ops"],
                "shared_file_ops":mod["shared_file_ops"],  # cross-module file coupling
                "comment_lines":  mod["comment_lines"],
                "code_lines":     mod["code_lines"],
                "goto_count":     mod["goto_count"],
                "paragraphs":     len(mod["paragraphs"]),
                "redefines":      mod["redefines"],
                "comp3":          mod["comp3"],
                "ebcdic":         mod["ebcdic"],            # Signal 9
                "dead_paragraphs":len(mod["dead_paragraphs"]),
            },
        }

    # ─────────────────────────────────────────────
    #  MRI COMPOSITE SCORE
    # ─────────────────────────────────────────────
    def _compute_mri(self, metrics):
        """
        Weighted arithmetic mean of the five normalised dimension scores.
        Weights are defined in MRI_WEIGHTS at module level so they stay
        in sync with the frontend's MRIFormulaCallout component.

        Formula note (§6): arithmetic vs geometric vs conjunctive
        aggregation is an open methodological question.
        """
        return sum(metrics[k] * w for k, w in MRI_WEIGHTS.items())

    def _classify(self, mri):
        if mri >= TIER_HIGH:
            return "HIGH"
        elif mri >= TIER_LOW:
            return "MEDIUM"
        else:
            return "LOW"

    def _recommend(self, tier, metrics):
        if tier == "HIGH":
            # Identify the dominant risk driver for a specific recommendation
            dominant = max(
                ["coupling_density", "documentation_deficit",
                 "logic_volatility", "data_complexity", "dead_code_ratio"],
                key=lambda k: metrics[k],
            )
            hints = {
                "coupling_density":      "Start by mapping and reducing inbound CALL coupling.",
                "documentation_deficit": "Document all WORKING-STORAGE variables before touching any code.",
                "logic_volatility":      "Restructure GOTO-laden paragraphs before attempting migration.",
                "data_complexity":       "Plan COMP-3/EBCDIC/REDEFINES conversion strategy first.",
                "dead_code_ratio":       "Prune dead paragraphs before migration to reduce scope.",
            }
            return (
                "Do NOT migrate yet. Requires expert review, decoupling, and full documentation. "
                + hints.get(dominant, "")
            )
        elif tier == "MEDIUM":
            return (
                "Migrate with caution. Reduce coupling, document business logic, "
                "and re-score with COBRisk before starting migration."
            )
        else:
            return (
                "Safe to migrate. Isolated and well-structured — "
                "ideal first candidate to build team confidence."
            )

    # ─────────────────────────────────────────────
    #  DEPENDENCY GRAPH
    # ─────────────────────────────────────────────
    def _build_graph(self):
        nodes = []
        edges = []
        name_map = {
            os.path.splitext(f)[0].upper(): f
            for f in self.modules
        }

        for filename, mod in self.modules.items():
            metrics = self._compute_metrics(mod)
            mri     = self._compute_mri(metrics)
            nodes.append({
                "id":    filename,
                "label": filename,
                "mri":   round(mri, 1),
                "tier":  self._classify(mri),
                "lines": mod["lines"],
            })

        seen_edges = set()
        for src_file, mod in self.modules.items():
            for called in mod["calls"]:
                target = name_map.get(called.upper())
                if target and target != src_file:
                    key = (src_file, target, "CALL")
                    if key not in seen_edges:
                        seen_edges.add(key)
                        edges.append({"source": src_file, "target": target, "type": "CALL"})
            for copied in mod["copies"]:
                target = name_map.get(copied.upper())
                if target and target != src_file:
                    key = (src_file, target, "COPY")
                    if key not in seen_edges:
                        seen_edges.add(key)
                        edges.append({"source": src_file, "target": target, "type": "COPY"})

        return {"nodes": nodes, "edges": edges}

    # ─────────────────────────────────────────────
    #  SUMMARY
    # ─────────────────────────────────────────────
    def _build_summary(self, results):
        total      = len(results)
        high       = sum(1 for r in results if r["tier"] == "HIGH")
        medium     = sum(1 for r in results if r["tier"] == "MEDIUM")
        low        = sum(1 for r in results if r["tier"] == "LOW")
        avg_mri    = sum(r["mri"] for r in results) / max(total, 1)
        total_lines = sum(r["lines"] for r in results)

        return {
            "total_modules":  total,
            "high_risk":      high,
            "medium_risk":    medium,
            "low_risk":       low,
            "average_mri":    round(avg_mri, 2),
            "total_lines":    total_lines,
            "safe_to_migrate": [r["filename"] for r in results if r["tier"] == "LOW"],
        }
