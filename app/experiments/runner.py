from app.baseline.simple_retry import baseline_decision
from app.data.models import DecisionRecord, ExecutionResult
from app.decision.engine import choose_decision
from app.diagnosis.rules import diagnose_with_rules
from app.diagnosis.llm import diagnose_with_llm
from app.compliance.firewall import apply_compliance
from app.evaluation.metrics import EvaluationMetrics, calculate_metrics
from app.execution.simulator import execute_decision
from app.simulation.generator import generate_payment_events

def diagnose_payment(event):
    """
    Use deterministic rules for known bank codes.
    Use the local LLM only for ambiguous/unknown codes.
    """

    known_codes = {"05", "51", "54", "62", "91"}

    if event.raw_bank_code in known_codes:
        return diagnose_with_rules(event)

    return diagnose_with_llm(event)

def diagnose_for_large_experiment(event):
    """
    Fast diagnosis path used for large-scale evaluation.

    Known bank codes use deterministic rules.
    Ambiguous codes are treated as unknown rather than
    repeatedly calling the local LLM.
    """
    return diagnose_with_rules(event)

def run_baseline(
    events,
    seed: int = 42,
) -> EvaluationMetrics:
    """Run the simple retry baseline on a batch of events."""

    executions: list[ExecutionResult] = []
    decisions: list[DecisionRecord] = []

    for event in events:
        decision = baseline_decision(event)

        decision_record = DecisionRecord(
            event_id=event.event_id,
            decision=decision,
            reason="Fair baseline: retry once after 24 hours.",
            compliance_override=False,
        )

        decisions.append(decision_record)

        execution = execute_decision(
            event,
            decision,
            seed,
        )

        executions.append(execution)

    return calculate_metrics(
        events,
        executions,
        decisions,
    )


def run_recover_ai(
    events,
    seed: int = 42,
) -> EvaluationMetrics:
    """Run the current rule-based RecoverAI strategy."""

    executions: list[ExecutionResult] = []
    decisions: list[DecisionRecord] = []

    for event in events:
        diagnosis = diagnose_payment(event)

        proposed_decision = choose_decision(diagnosis)

        decisions.append(proposed_decision)

        execution = execute_decision(
            event,
            proposed_decision.decision,
            seed,
        )

        executions.append(execution)

    return calculate_metrics(
        events,
        executions,
        decisions,
    )


def run_comparison(
    count: int = 80,
    seed: int = 42,
) -> tuple[EvaluationMetrics, EvaluationMetrics]:

    events = generate_payment_events(
        count=count,
        seed=seed,
    )

    baseline_metrics = run_baseline(
        events,
        seed,
    )

    recover_ai_metrics = run_recover_ai(
        events,
        seed,
    )

    return baseline_metrics, recover_ai_metrics

def run_large_experiment(
    count: int = 1000,
    seed: int = 42,
) -> EvaluationMetrics:
    """Run a fast large-scale RecoverAI evaluation."""

    events = generate_payment_events(
        count=count,
        seed=seed,
    )

    executions: list[ExecutionResult] = []
    decisions: list[DecisionRecord] = []

    for event in events:
        diagnosis = diagnose_for_large_experiment(event)

        proposed_decision = choose_decision(diagnosis)

        final_decision = apply_compliance(
            event,
            diagnosis,
            proposed_decision,
        )

        decisions.append(final_decision)

        execution = execute_decision(
            event,
            final_decision.decision,
            seed,
        )

        executions.append(execution)

    return calculate_metrics(
        events,
        executions,
        decisions,
    )