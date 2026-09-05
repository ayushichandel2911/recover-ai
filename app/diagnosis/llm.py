import json
import requests

from app.data.models import Diagnosis, FailureCode, PaymentEvent


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"

ALLOWED_FAILURE_CODES = {
    "card_declined": FailureCode.CARD_DECLINED,
    "insufficient_funds": FailureCode.INSUFFICIENT_FUNDS,
    "expired_card": FailureCode.EXPIRED_CARD,
    "stolen_card_suspected": FailureCode.STOLEN_CARD_SUSPECTED,
    "processor_error": FailureCode.PROCESSOR_ERROR,
    "unknown": FailureCode.UNKNOWN,
}


def diagnose_with_llm(event: PaymentEvent) -> Diagnosis:
    """
    Diagnose an ambiguous payment failure using a local LLM.

    The LLM must only use observable payment information.
    Hidden ground truth is never sent to the model.

    For an unmapped/ambiguous bank code, the model must prefer
    'unknown' rather than guessing a specific failure reason.
    """

    prompt = f"""
You are a payment failure diagnosis assistant.

Your job is to classify a failed payment using ONLY the observable
information provided below.

PAYMENT INFORMATION
Bank/processor code: {event.raw_bank_code}
Attempt number: {event.attempt_number}
Amount: {event.amount_cents / 100:.2f} {event.currency.upper()}

ALLOWED FAILURE CODES
1. card_declined
2. insufficient_funds
3. expired_card
4. stolen_card_suspected
5. processor_error
6. unknown

CRITICAL CLASSIFICATION RULES

- Do NOT guess.
- Do NOT infer a specific failure reason merely from the payment amount.
- Do NOT assume an unfamiliar bank/processor code means insufficient_funds.
- Do NOT assume an unfamiliar bank/processor code means card_declined.
- Do NOT assume an unfamiliar bank/processor code means processor_error.
- The bank/processor code {event.raw_bank_code} is not enough evidence by
  itself to identify a specific failure reason unless that code is explicitly
  known from the information provided.
- If the available evidence does not uniquely support one of the specific
  failure codes, return "unknown".
- "unknown" is the correct answer when evidence is insufficient.

CONFIDENCE RULES

- Use high confidence only when the provided evidence clearly supports
  the diagnosis.
- For an unfamiliar or ambiguous bank code, confidence should be low.
- Never increase confidence simply because you are forced to choose a label.

OUTPUT

Return ONLY valid JSON.
Do not use markdown.
Do not add additional fields.

Required format:

{{
  "failure_code": "unknown",
  "confidence": 0.0,
  "reasoning": "The provided information does not contain enough evidence to determine a specific failure reason."
}}
"""

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0,
        },
    }

    response = requests.post(
        OLLAMA_URL,
        json=payload,
        timeout=120,
    )

    response.raise_for_status()

    data = response.json()
    response_text = data.get("response", "").strip()

    if not response_text:
        return Diagnosis(
            event_id=event.event_id,
            failure_code=FailureCode.UNKNOWN,
            confidence=0.0,
            method="llm",
            reasoning="LLM returned an empty response.",
        )

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"LLM returned invalid JSON: {response_text}"
        ) from exc

    raw_failure_code = str(
        result.get("failure_code", "unknown")
    ).strip().lower()

    failure_code = ALLOWED_FAILURE_CODES.get(
        raw_failure_code,
        FailureCode.UNKNOWN,
    )

    try:
        confidence = float(result.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0

    confidence = max(0.0, min(1.0, confidence))

    reasoning = str(
        result.get(
            "reasoning",
            "The available evidence was insufficient to determine a specific failure reason.",
        )
    ).strip()

    return Diagnosis(
        event_id=event.event_id,
        failure_code=failure_code,
        confidence=confidence,
        method="llm",
        reasoning=reasoning,
    )