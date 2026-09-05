from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime


class FailureCode(str, Enum):
    """The diagnosed reason a payment failed."""
    CARD_DECLINED = "card_declined"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    EXPIRED_CARD = "expired_card"
    STOLEN_CARD_SUSPECTED = "stolen_card_suspected"
    PROCESSOR_ERROR = "processor_error"
    UNKNOWN = "unknown"


class Decision(str, Enum):
    """The action the system chooses to take in response to a diagnosis."""
    RETRY_NOW = "retry_now"
    RETRY_LATER = "retry_later"
    SEND_PAYMENT_LINK = "send_payment_link"
    ESCALATE = "escalate"
    STOP = "stop"


class PaymentEvent(BaseModel):
    """
    One failed payment. This is the input to the whole pipeline.

    metadata.true_failure_reason is the hidden ground truth used only
    for later evaluation.
    """
    event_id: str
    customer_id: str
    amount_cents: int
    currency: str = "inr"
    raw_bank_code: str
    attempt_number: int = 1
    customer_opted_out: bool = False
    created_at: datetime
    metadata: dict = Field(default_factory=dict)


class Diagnosis(BaseModel):
    """The system's determination of WHY a payment failed."""
    event_id: str
    failure_code: FailureCode
    confidence: float = Field(ge=0.0, le=1.0)
    method: str
    reasoning: str


class DecisionRecord(BaseModel):
    """The system's determination of WHAT TO DO about a diagnosed failure."""
    event_id: str
    decision: Decision
    reason: str
    compliance_override: bool = False


class ExecutionResult(BaseModel):
    """The simulated outcome of carrying out a decision."""
    event_id: str
    action_taken: Decision
    success: bool
    amount_recovered_cents: int = 0


class AuditRecord(BaseModel):
    """
    The full explainable record of one payment's journey:
    diagnosis -> decision -> execution.
    """
    event_id: str
    diagnosis: Diagnosis
    decision: DecisionRecord
    execution: ExecutionResult
    timestamp: datetime