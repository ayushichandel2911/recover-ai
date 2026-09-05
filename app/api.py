import os
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.webhooks import router as webhook_router

from app.data.models import PaymentEvent, AuditRecord
from app.diagnosis.rules import diagnose_with_rules
from app.diagnosis.llm import diagnose_with_llm
from app.decision.engine import choose_decision
from app.compliance.firewall import apply_compliance
from app.execution.simulator import execute_decision
from app.audit.logger import (
    save_audit_record,
    load_audit_records,
)

from app.simulation.generator import generate_payment_events
from app.experiments.runner import (
    run_baseline,
    diagnose_for_large_experiment,
)
from app.evaluation.metrics import calculate_metrics


api = FastAPI(
    title="RecoverAI API",
    description="AI-powered failed payment recovery agent",
    version="1.0.0",
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "https://recover-ai-theta-gray.vercel.app",
]

frontend_url = os.getenv("FRONTEND_URL")

if frontend_url:
    allowed_origins.append(frontend_url)

api.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


api.include_router(webhook_router)


class PaymentRequest(BaseModel):
    event: PaymentEvent


# --------------------------------------------------
# BASIC ROUTES
# --------------------------------------------------

@api.get("/")
def root():
    return {
        "name": "RecoverAI",
        "message": "AI-powered payment recovery agent is running",
    }


@api.get("/health")
def health():
    return {
        "status": "ok",
    }


# --------------------------------------------------
# DIAGNOSIS
# --------------------------------------------------

def diagnose_event(event: PaymentEvent):
    known_codes = {
        "05",
        "51",
        "54",
        "62",
        "91",
    }

    if event.raw_bank_code in known_codes:
        return diagnose_with_rules(event)

    return diagnose_with_llm(event)


@api.post("/payments/diagnose")
def diagnose_payment(request: PaymentRequest):
    event = request.event

    diagnosis = diagnose_event(event)

    return diagnosis


# --------------------------------------------------
# RECOVERY
# --------------------------------------------------

@api.post("/payments/recover")
def recover_payment(request: PaymentRequest):
    event = request.event

    diagnosis = diagnose_event(event)

    proposed_decision = choose_decision(
        diagnosis
    )

    final_decision = apply_compliance(
        event,
        diagnosis,
        proposed_decision,
    )

    execution = execute_decision(
        event,
        final_decision.decision,
        seed=42,
    )

    audit_record = AuditRecord(
        event_id=event.event_id,
        diagnosis=diagnosis,
        decision=final_decision,
        execution=execution,
        timestamp=datetime.now(),
    )

    save_audit_record(audit_record)

    return {
        "event_id": event.event_id,
        "diagnosis": diagnosis,
        "decision": final_decision,
        "execution": execution,
        "audit_logged": True,
    }


# --------------------------------------------------
# AUDIT
# --------------------------------------------------

@api.get("/audit")
def get_audit():
    records = load_audit_records()

    return {
        "count": len(records),
        "records": records[-20:],
    }


# --------------------------------------------------
# EVALUATION
# --------------------------------------------------

@api.get("/evaluate")
def evaluate():

    events = generate_payment_events(
        count=1000,
        seed=42,
    )

    # -------------------------
    # BASELINE