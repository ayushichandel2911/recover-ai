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


@api.get("/audit")
def get_audit():
    records = load_audit_records()

    return {
        "count": len(records),
        "records": records[-20:],
    }


@api.get("/evaluate")
def evaluate():
    try:
        events = generate_payment_events(
            count=1000,
            seed=42,
        )

        baseline = run_baseline(
            events,
            seed=42,
        )

        executions = []
        decisions = []

        for event in events:
            diagnosis = diagnose_for_large_experiment(event)
            proposed_decision = choose_decision(diagnosis)
            final_decision = apply_compliance(event, diagnosis, proposed_decision)
            decisions.append(final_decision)
            execution = execute_decision(event, final_decision.decision, seed=42)
            executions.append(execution)

        recover_ai = calculate_metrics(events, executions, decisions)

        def metrics_to_dict(result):
            return {
                "revenue_at_risk_rupees": round(result.revenue_at_risk_rupees, 2),
                "recovered_revenue_rupees": round(result.recovered_revenue_rupees, 2),
                "recovery_rate_percent": round(result.recovery_rate_percent, 2),
                "successful_recoveries": result.successful_recoveries,
                "recovery_attempts": result.recovery_attempts,
                "wasted_attempts": result.wasted_attempts,
                "compliance_overrides": result.compliance_overrides,
                "missed_recoverable_events": result.missed_recoverable_events,
            }

        return {
            "events": len(events),
            "baseline": metrics_to_dict(baseline),
            "recover_ai": metrics_to_dict(recover_ai),
        }
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}