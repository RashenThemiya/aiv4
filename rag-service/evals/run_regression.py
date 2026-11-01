"""Run repeatable, history-free QA checks against a deployed RAG service."""

import json
import os
import re
import sys
from pathlib import Path
from urllib import request
from urllib.error import HTTPError, URLError


def normalized(value: str) -> str:
    text = str(value or "").casefold()
    text = re.sub(r"\b(?:above|more\s+than)\b", ">", text)
    text = re.sub(r"\b(?:below|less\s+than)\b", "<", text)
    text = re.sub(r"\bat\s+least\b", ">=", text)
    text = re.sub(r"\bwatts?\b", "w", text)
    text = re.sub(r"\bvolts?\b", "v", text)
    text = re.sub(r"\b(?:amps?|amperes?)\b", "a", text)
    return re.sub(r"\s+", "", text)


def main() -> int:
    company_id = os.getenv("QA_COMPANY_ID", "").strip()
    base_url = os.getenv("RAG_SERVICE_URL", "http://localhost:8000").rstrip("/")
    if not company_id:
        print("Set QA_COMPANY_ID before running the regression suite.")
        return 2

    cases = json.loads(
        Path(__file__).with_name("qa_regression.json").read_text(encoding="utf-8")
    )
    failures = []
    for case in cases:
        payload = json.dumps({
            "company_id": company_id,
            "question": case["question"],
            "history": case.get("history", []),
            "preferred_document_ids": case.get("preferred_document_ids", []),
            "preferred_product_names": case.get("preferred_product_names", []),
            "preferred_model_ids": case.get("preferred_model_ids", []),
        }).encode("utf-8")
        http_request = request.Request(
            f"{base_url}/query",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(http_request, timeout=180) as response:
                result = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as exc:
            failures.append((case["id"], [f"request failed: {exc}"]))
            print(f"FAIL {case['id']}")
            continue

        answer = normalized(result.get("answer", ""))
        source_names = " ".join(
            source.get("document_name", "") for source in result.get("sources", [])
        )
        reasons = []
        for fact in case.get("expected_facts", []):
            if normalized(fact) not in answer:
                reasons.append(f"missing expected fact: {fact}")
        for fact in case.get("forbidden_facts", []):
            if normalized(fact) in answer:
                reasons.append(f"included forbidden fact: {fact}")
        expected_model = normalized(case.get("expected_model", ""))
        if expected_model and expected_model not in normalized(source_names):
            reasons.append("source is not from the expected model")
        expected_source = normalized(case.get("expected_source", ""))
        if expected_source and expected_source not in normalized(source_names):
            reasons.append(f"missing expected source: {case['expected_source']}")
        for forbidden_source in case.get("forbidden_sources", []):
            if normalized(forbidden_source) in normalized(source_names):
                reasons.append(f"included forbidden source: {forbidden_source}")
        if result.get("suggestions"):
            reasons.append("unexpected clarification suggestions")

        status = "PASS" if not reasons else "FAIL"
        print(f"{status} {case['id']}")
        if reasons:
            failures.append((case["id"], reasons))

    for case_id, reasons in failures:
        print(f"\n{case_id}: " + "; ".join(reasons))
    print(f"\n{len(cases) - len(failures)}/{len(cases)} checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
