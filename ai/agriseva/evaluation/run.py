import argparse

from agriseva.evaluation.questions import TEST_CASES
from agriseva.evaluation.executors import run_mock_case, run_live_case
from agriseva.evaluation.tech import evaluate_technical
from agriseva.evaluation.failure import classify_failure
from agriseva.evaluation.report import write_csv_report
from agriseva.evaluation.routing import evaluate_routing
from agriseva.evaluation.trace import extract_trace_summary
from agriseva.evaluation.tool import evaluate_tools
from agriseva.evaluation.summary import build_summary
from agriseva.evaluation.triage import triage_result
from agriseva.evaluation.nodes import evaluate_nodes
from agriseva.evaluation.plan import evaluate_plan
from agriseva.evaluation.answer_eval import evaluate_response_quality
from agriseva.evaluation.validators.source_check import evaluate_source_attribution
from agriseva.evaluation.validators.disclaimer_language import evaluate_disclaimer_language
from agriseva.evaluation.langsmith_trace import build_langsmith_trace_url


def run_case(case: dict, mode: str) -> dict:
    if mode == "mock":
        result = run_mock_case(case)
    elif mode == "live":
        result = run_live_case(case)
    else:
        raise ValueError(f"Unsupported mode: {mode}")

    technical_result = evaluate_technical(result, case)
    routing_result = evaluate_routing(result, case)
    trace_result = extract_trace_summary(result)
    tool_result = evaluate_tools(result, case)
    source_result = evaluate_source_attribution(result, case)
    node_result = evaluate_nodes(result, case)
    plan_result = evaluate_plan(result, case)
    trace_result = build_langsmith_trace_url(result)
    disclaimer_language_result = evaluate_disclaimer_language(result, case)

    quality_result = evaluate_response_quality(
        result,
        enabled=(mode == "live"),
    )

    combined = {
        **result,
        **technical_result,
        **routing_result,
        **tool_result,
        **trace_result,
        **node_result,
        **plan_result,
        **quality_result,
        **source_result,
        **trace_result,
        **disclaimer_language_result,
    }

    failure_result = classify_failure(combined)
    triage_output = triage_result({**combined, **failure_result})

    final_result = {
        **combined,
        **failure_result,
        **triage_output,
    }

    final_result.pop("trace", None)

    return final_result


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--mode",
        choices=["mock", "live"],
        default="mock",
        help="Run evaluation in mock mode or live mode.",
    )

    parser.add_argument(
        "--stable-only",
        action="store_true",
        help="Run only stable test cases.",
    )

    args = parser.parse_args()

    selected_cases = TEST_CASES

    if args.stable_only:
        selected_cases = [
            case for case in TEST_CASES
            if case.get("stable") is True
        ]

    results = []

    for case in selected_cases:
        print(f"Running [{args.mode}]: {case.get('name')}")
        results.append(run_case(case, args.mode))

    output_file = f"evaluation_report_{args.mode}.csv"
    write_csv_report(results, output_file=output_file)
    summary = build_summary(results)
    print("Summary:", summary)


if __name__ == "__main__":
    main()