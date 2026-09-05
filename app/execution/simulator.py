import random

from app.data.models import (
    Decision,
    ExecutionResult,
    PaymentEvent,
)


def get_simulation_reason(event: PaymentEvent):
    """
    Get the failure reason used by the execution simulator.

    Large evaluations provide hidden ground truth through
    metadata["true_failure_reason"].

    Live demo events may not contain that hidden metadata, so
    we fall back to the bank code only for simulation purposes.
    """

    # 1. Prefer hidden ground truth when available.
    true_reason = event.metadata.get("true_failure_reason")

    if true_reason:
        return true_reason

    # 2. Fallback for live demo events.
    code_map = {
        "05": "card_declined",
        "51": "insufficient_funds",
        "54": "expired_card",
        "62": "stolen_card_suspected",
        "91": "processor_error",
    }

    return code_map.get(event.raw_bank_code)


def execute_decision(
    event: PaymentEvent,
    decision: Decision,
    seed: int = 42,
) -> ExecutionResult:
    """
    Simulate the outcome of a recovery action.

    For evaluation events, the simulator uses the hidden
    true_failure_reason stored in event metadata.

    For live demo events where that metadata is absent,
    the bank-code mapping is used only to make the execution
    simulator behave realistically.
    """

    event_seed = sum(ord(char) for char in event.event_id)
    rng = random.Random(seed + event_seed)

    reason = get_simulation_reason(event)

    success_probability = 0.0

    if decision == Decision.RETRY_NOW:
        if reason == "card_declined":
            success_probability = 0.35
        elif reason == "processor_error":
            success_probability = 0.70
        else:
            success_probability = 0.05

    elif decision == Decision.RETRY_LATER:
        if reason == "insufficient_funds":
            success_probability = 0.55
        elif reason == "processor_error":
            success_probability = 0.60
        else:
            success_probability = 0.05

    elif decision == Decision.SEND_PAYMENT_LINK:
        if reason == "expired_card":
            success_probability = 0.65
        elif reason == "insufficient_funds":
            success_probability = 0.20
        else:
            success_probability = 0.05

    elif decision == Decision.ESCALATE:
        success_probability = 0.10

    elif decision == Decision.STOP:
        success_probability = 0.0

    success = rng.random() < success_probability

    recovered_amount = event.amount_cents if success else 0

    return ExecutionResult(
        event_id=event.event_id,
        action_taken=decision,
        success=success,
        amount_recovered_cents=recovered_amount,
    )