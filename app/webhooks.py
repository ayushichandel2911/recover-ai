import hashlib
import hmac
import json
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException, Request

from app.audit.logger import save_audit_record
from app.compliance.firewall import apply_compliance
from app.data.models import AuditRecord, PaymentEvent
from app.decision.engine import choose_decision
from app.diagnosis.llm import diagnose_with_llm
from app.diagnosis.rules import diagnose_with_rules
from app.execution.simulator import execute_decision
from app.razorpay_service import (
    create_payment_link,
    razorpay_configured,
)


router = APIRouter(
    prefix="/webhooks",
    tags=["Webhooks"],
)

KNOWN_CODES = {"05", "51", "54", "62", "91"}


def verify_signature(
    body: bytes,
    signature: str | None,
    secret: str,
) -> bool:
    if not signature or not secret:
        return False

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(
        expected_signature,
        signature,
    )


def extract_payment_event(payload: dict) -> PaymentEvent:
    payment = (
        payload
        .get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )

    payment_id = payment.get(
        "id",
        "unknown_payment",
    )

    amount = int(
        payment.get("amount", 0)
    )

    currency = payment.get(
        "currency",
        "INR",
    ).lower()

    error_code = (
        payment.get("error_code")
        or "unknown"
    )

    notes = payment.get("notes") or {}

    customer_id = (
        notes.get("customer_id")
        or payment.get("email")
        or f"customer_{payment_id}"
    )

    return PaymentEvent(
        event_id=payment_id,
        customer_id=str(customer_id),
        amount_cents=amount,
        currency=currency,
        raw_bank_code=str(error_code),
        attempt_number=1,
        customer_opted_out=False,
        created_at=datetime.now(),
        metadata={
            "source": "razorpay_webhook",
            "webhook_event": payload.get("event"),
        },
    )


def diagnose_event(event: PaymentEvent):
    if event.raw_bank_code in KNOWN_CODES:
        return diagnose_with_rules(event)

    return diagnose_with_llm(event)


@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str | None = Header(
        default=None
    ),
):
    body = await request.body()

    from app.config import settings

    webhook_secret = getattr(
        settings,
        "razorpay_webhook_secret",
        "",
    )

    # Verify signature when a webhook secret is configured.
    if webhook_secret:
        if not verify_signature(
            body,
            x_razorpay_signature,
            webhook_secret,
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid Razorpay webhook signature.",
            )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON payload.",
        )

    event_name = payload.get("event")

    # RecoverAI only processes failed payments.
    if event_name != "payment.failed":
        return {
            "status": "ignored",
            "event": event_name,
            "reason": (
                "RecoverAI only processes "
                "payment.failed events."
            ),
        }

    # Convert Razorpay event into RecoverAI event.
    event = extract_payment_event(payload)

    # Diagnose.
    diagnosis = diagnose_event(event)

    # Decide.
    proposed_decision = choose_decision(
        diagnosis
    )

    # Compliance firewall.
    final_decision = apply_compliance(
        event,
        diagnosis,
        proposed_decision,
    )

    # Execute bounded recovery action.
    execution = execute_decision(
        event,
        final_decision.decision,
        seed=42,
    )

    # Create a real Razorpay Payment Link
    # when credentials are configured.
    payment_link = None

    if final_decision.decision.value == "send_payment_link":
        if razorpay_configured():
            payment_link = create_payment_link(
                amount_cents=event.amount_cents,
                currency=event.currency,
                reference_id=event.event_id,
                description="RecoverAI payment recovery",
            )

    # Create audit record.
    audit_record = AuditRecord(
        event_id=event.event_id,
        diagnosis=diagnosis,
        decision=final_decision,
        execution=execution,
        timestamp=datetime.now(),
    )

    save_audit_record(audit_record)

    return {
        "status": "processed",
        "event_id": event.event_id,
        "diagnosis": diagnosis,
        "decision": final_decision,
        "execution": execution,
        "payment_link_created": payment_link is not None,
        "payment_link": payment_link,
        "audit_logged": True,
    }