import razorpay

from app.config import settings


def razorpay_configured() -> bool:
    return bool(
        settings.razorpay_key_id
        and settings.razorpay_key_secret
    )


def create_payment_link(
    amount_cents: int,
    currency: str,
    reference_id: str,
    description: str,
):
    if not razorpay_configured():
        return None

    client = razorpay.Client(
        auth=(
            settings.razorpay_key_id,
            settings.razorpay_key_secret,
        )
    )

    data = {
        "amount": amount_cents,
        "currency": currency.upper(),
        "accept_partial": False,
        "reference_id": reference_id,
        "description": description,
    }

    return client.payment_link.create(data)