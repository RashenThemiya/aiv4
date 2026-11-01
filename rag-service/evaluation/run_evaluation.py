"""Run a small, repeatable retrieval and answer accuracy evaluation."""

import argparse
import json
from pathlib import Path

import httpx


def load_cases(path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--url", default="http://localhost:8000")
    args = parser.parse_args()
    cases = load_cases(args.dataset)
    passed = 0

    with httpx.Client(timeout=120) as client:
        for index, case in enumerate(cases, 1):
            response = client.post(
                f"{args.url.rstrip('/')}/query",
                json={
                    "company_id": case["company_id"],
                    "question": case["question"],
                },
            )
            response.raise_for_status()
            result = response.json()
            answer = result["answer"].casefold()
            sources = result.get("sources", [])

            checks = []
            if case.get("expected_document"):
                checks.append(any(
                    source.get("document_name") == case["expected_document"]
                    for source in sources
                ))
            if case.get("expected_page") is not None:
                checks.append(any(
                    source.get("page_number") == case["expected_page"]
                    for source in sources
                ))
            checks.extend(
                phrase.casefold() in answer
                for phrase in case.get("answer_contains", [])
            )
            if case.get("should_refuse"):
                checks.append(
                    "don't have that information" in answer
                    or "couldn't find relevant information" in answer
                )

            ok = all(checks) if checks else True
            passed += int(ok)
            print(f"{'PASS' if ok else 'FAIL'} {index}: {case['question']}")

    total = len(cases)
    print(f"\nAccuracy: {passed}/{total} ({(passed / total * 100) if total else 0:.1f}%)")


if __name__ == "__main__":
    main()
