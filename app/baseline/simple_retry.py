from app.data.models import Decision, PaymentEvent


def baseline_decision(event: PaymentEvent) -> Decision:
    """
    Fair baseline:
    Retry every failed payment once after 24 hours,
    unless the customer has opted out.
    """

    if event.customer_opted_out:
        return Decision.STOP

    return Decision.RETRY_LATER