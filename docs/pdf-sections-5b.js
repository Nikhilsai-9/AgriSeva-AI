// Section 8 part 2: Evaluation harness.
module.exports = [
  function s8b(H) {
    H.H2("8.3  Evaluation harness");
    H.UL([
      "evaluation/run.py + evaluation/plan.py + evaluation/nodes.py + evaluation/routing.py + evaluation/stream_debug.py.",
      "evaluation/all_tools.py and tool.py list every MCP tool the harness can exercise.",
      "evaluation/langsmith_*.py and evaluation/deepeval_*.py integrate LangSmith + DeepEval.",
      "evaluation/questions.py + report.py + summary.py form the golden-dataset scoring suite.",
      "evaluation/failure.py captures regression diffs.",
    ]);
  },
];
