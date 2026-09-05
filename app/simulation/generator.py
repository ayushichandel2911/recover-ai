import random
from datetime import datetime, timedelta

from app.data.models import PaymentEvent


# These are the failure reasons our simulator understands.
FAILURE_REASONS = [
    "card_declined",
    "insufficient_funds",
    "expired_card",
    "stolen_card_suspected",
    "processor_error",
]


# Bank/processor codes that our system will receive.
# Some are clear, while others will intentionally be ambiguous.
BANK_CODES = {
    "05": "card_declined",
    "51": "insufficient_funds",
    "54": "expired_card",
    "62": "stolen_card_suspected",
    "91": "processor_error",
}


# Codes that are deliberately ambiguous.
# These are useful later when testing the LLM.
AMBIGUOUS_CODES = [
    "96",
    "R1",
    "X7",
]


def generate_payment_events(
    count: int = 80,
    seed: int = 42,
) -> list[PaymentEvent]:
    """
    Generate a reproducible synthetic dataset of failed payments.

    The true failure reason is stored in metadata as hidden ground truth.
    The diagnosis system must never read this value.
    """

    rng = random.Random(seed)

    events = []

    start_time = datetime(2026, 1, 1, 9, 0, 0)

    for i in range(count):
        event_id = f"evt_{i + 1:04d}"
        customer_id = f"cust_{rng.randint(1000, 9999)}"

        amount_cents = rng.choice(
            [
                49900,
                99900,
                149900,
                249900,
                499900,
                999900,
            ]
        )

        # Choose the real underlying reason.
        true_reason = rng.choice(FAILURE_REASONS)

        # Most events use recognizable bank codes.
        # Some deliberately use ambiguous codes.
        if rng.random() < 0.25:
            raw_bank_code = rng.choice(AMBIGUOUS_CODES)
        else:
            matching_codes = [
                code
                for code, reason in BANK_CODES.items()
                if reason == true_reason
            ]
            raw_bank_code = rng.choice(matching_codes)

        attempt_number = rng.choice([1, 1, 1, 2])

        customer_opted_out = rng.random() < 0.10

        created_at = start_time + timedelta(
            minutes=i * 15
        )

        event = PaymentEvent(
            event_id=event_id,
            customer_id=customer_id,
            amount_cents=amount_cents,
            raw_bank_code=raw_bank_code,
            attempt_number=attempt_number,
            customer_opted_out=customer_opted_out,
            created_at=created_at,
            metadata={
                "true_failure_reason": true_reason
            },
        )

        events.append(event)

    return events