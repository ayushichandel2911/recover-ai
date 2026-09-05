from app.data.models import (
    Decision,
    DecisionRecord,
    Diagnosis,
    FailureCode,
)


def choose_decision(diagnosis: Diagnosis) -> DecisionRecord:
    """
    Choose a recovery action based on the diagnosed failure reason.

    This function only proposes an action.
    The compliance firewall has final authority and can override it.
    """

    if diagnosis.failure_code == FailureCode.INSUFFICIENT_FUNDS:
        return DecisionRecord(
            event_id=diagnosis.event_id,
            decision=Decision.RETRY_LATER,
            reason="Insufficient funds may be temporary; retry later.",
        )

    if diagnosis.failure_code == FailureCode.EXPIRED_CARD:
        return DecisionRecord(
            event_id=diagnosis.event_id,
            decision=Decision.SEND_PAYMENT_LINK,
            reason="Card appears expired; ask customer to update payment method.",
        )

    if diagnosis.failure_code == FailureCode.CARD_DECLINED:
        return DecisionRecord(
            event_id=diagnosis.event_id,
            decision=Decision.RETRY_NOW,
            reason="Card decline may be transient; attempt one bounded retry.",
        )

    if diagnosis.failure_code == FailureCode.PROCESSOR_ERROR:
        return DecisionRecord(
            event_id=diagnosis.event_id,
            decision=Decision.RETRY_NOW,
            reason="Processor error may be transient; retry now.",
        )

    if diagnosis.failure_code == FailureCode.STOLEN_CARD_SUSPECTED:
        return DecisionRecord(
            event_id=diagnosis.event_id,
            decision=Decision.STOP,
            reason="Stolen card suspected; do not attempt recovery.",
        )

    # Unknown diagnoses should not trigger aggressive recovery.
    return DecisionRecord(
        event_id=diagnosis.event_id,
        decision=Decision.ESCALATE,
        reason="Failure reason is unknown; escalate for further investigation.",
    )