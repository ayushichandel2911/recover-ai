from app.data.models import (
    Decision,
    DecisionRecord,
    Diagnosis,
    PaymentEvent,
    FailureCode,
)


def apply_compliance(
    event: PaymentEvent,
    diagnosis: Diagnosis,
    proposed_decision: DecisionRecord,
) -> DecisionRecord:
    """
    Apply hard compliance rules to a proposed decision.

    The compliance layer is authoritative.
    It can override an AI/rule decision when a hard safety
    condition is present.
    """

    # Rule 1: Customer has opted out.
    if event.customer_opted_out:
        return DecisionRecord(
            event_id=event.event_id,
            decision=Decision.STOP,
            reason="Customer has opted out of payment recovery.",
            compliance_override=True,
        )

    # Rule 2: Stolen card suspected.
    if diagnosis.failure_code == FailureCode.STOLEN_CARD_SUSPECTED:
        return DecisionRecord(
            event_id=event.event_id,
            decision=Decision.STOP,
            reason="Stolen card suspected; recovery attempts are blocked.",
            compliance_override=True,
        )

    # No compliance rule triggered.
    return proposed_decision