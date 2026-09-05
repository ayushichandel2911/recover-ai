from app.data.models import (
    Diagnosis,
    FailureCode,
    PaymentEvent,
)


# Deterministic mapping for bank codes whose meaning is known.
BANK_CODE_RULES = {
    "05": FailureCode.CARD_DECLINED,
    "51": FailureCode.INSUFFICIENT_FUNDS,
    "54": FailureCode.EXPIRED_CARD,
    "62": FailureCode.STOLEN_CARD_SUSPECTED,
    "91": FailureCode.PROCESSOR_ERROR,
}


def diagnose_with_rules(event: PaymentEvent) -> Diagnosis:
    """
    Diagnose a payment using deterministic bank-code rules.

    Known codes are handled with high confidence.
    Unknown/ambiguous codes are returned as UNKNOWN so that
    a later LLM layer can handle them.
    """

    failure_code = BANK_CODE_RULES.get(
        event.raw_bank_code,
        FailureCode.UNKNOWN,
    )

    if failure_code == FailureCode.UNKNOWN:
        return Diagnosis(
            event_id=event.event_id,
            failure_code=FailureCode.UNKNOWN,
            confidence=0.0,
            method="rule",
            reasoning=(
                f"Bank code '{event.raw_bank_code}' has no "
                "deterministic rule."
            ),
        )

    return Diagnosis(
        event_id=event.event_id,
        failure_code=failure_code,
        confidence=1.0,
        method="rule",
        reasoning=(
            f"Bank code '{event.raw_bank_code}' matched "
            f"the deterministic rule for '{failure_code.value}'."
        ),
    )