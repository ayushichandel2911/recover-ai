from app.diagnosis.llm import diagnose_with_llm
from app.simulation.generator import generate_payment_events


AMBIGUOUS_CODES = {"96", "R1", "X7"}


def run_llm_benchmark(
    count: int = 30,
    seed: int = 42,
) -> dict:

    events = generate_payment_events(
        count=count,
        seed=seed,
    )

    ambiguous_events = [
        event
        for event in events
        if event.raw_bank_code in AMBIGUOUS_CODES
    ]

    correct = 0
    total = len(ambiguous_events)

    results = []

    for event in ambiguous_events:
        diagnosis = diagnose_with_llm(event)

        true_reason = event.metadata["true_failure_reason"]

        is_correct = (
            diagnosis.failure_code.value == true_reason
        )

        if is_correct:
            correct += 1

        results.append({
            "event_id": event.event_id,
            "bank_code": event.raw_bank_code,
            "prediction": diagnosis.failure_code.value,
            "true_reason": true_reason,
            "confidence": diagnosis.confidence,
            "correct": is_correct,
        })

    accuracy = correct / total if total else 0.0

    return {
        "total_ambiguous_events": total,
        "correct": correct,
        "incorrect": total - correct,
        "accuracy": accuracy,
        "results": results,
    }