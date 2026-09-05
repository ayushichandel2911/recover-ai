import json
import os

import requests

from app.data.models import Diagnosis, FailureCode, PaymentEvent


OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://localhost:11434/api/generate",
)

OLLAMA_MODEL = os.getenv(
    "OLLAMA_MODEL",
    "llama3.2:3b",
)


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
    Use an LLM to diagnose unfamiliar payment failures.

    Important:
    - Never guess a failure reason from the payment amount.
    - Never treat an unfamiliar bank code as proof of a specific reason.
    - If there is insufficient evidence, return UNKNOWN.
    - If Ollama is unavailable, safely fall back to UNKNOWN.
    """

    prompt = f"""
You are a payment-failure diagnosis assistant.

Analyze the following payment event.

Payment event:
- Event ID: {event.event_id}
- Amount: {event.amount_cents} cents
- Currency: {event.currency}
- Bank code: {event.raw_bank_code}
- Metadata: {json.dumps(event.metadata)}

Your job is to identify the most likely payment failure reason.

Allowed failure codes ONLY:
- card_declined
- insufficient_funds
- expired_card
- stolen_card_suspected
- processor_error
- unknown

STRICT RULES:

1. Do NOT guess.
2. Do NOT infer insufficient funds from the payment amount.
3. Do NOT assume an unfamiliar bank code means insufficient funds.
4. Do NOT classify a payment as stolen unless there is explicit evidence.
5. If the available information does not provide enough evidence for a specific reason, return "unknown".
6. Use low confidence when the evidence is weak or ambiguous.
7. Return ONLY valid JSON.
8. Do not include markdown or explanations outside the JSON.

Return exactly this structure:

{{
    "failure_code": "one_allowed_failure_code",
    "confidence": 0.0,
    "reasoning": "short explanation based only on the provided evidence"
}}
"""

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
            },
            timeout=15,
        )

        response.raise_for_status()

        data = response.json()
        raw_response = data.get("response", "").strip()

        if not raw_response:
            return Diagnosis(
                failure_code=FailureCode.UNKNOWN,
                confidence=0.0,
                reasoning="LLM returned an empty response.",
                method="llm",
            )

        result = json.loads(raw_response)

        failure_code_text = str(
            result.get("failure_code", "unknown")
        ).strip().lower()

        if failure_code_text not in ALLOWED_FAILURE_CODES:
            failure_code_text = "unknown"

        failure_code = ALLOWED_FAILURE_CODES[
            failure_code_text
        ]

        try:
            confidence = float(
                result.get("confidence", 0.0)
            )
        except (TypeError, ValueError):
            confidence = 0.0

        # Keep confidence safely between 0 and 1.
        confidence = max(
            0.0,
            min(1.0, confidence),
        )

        reasoning = str(
            result.get(
                "reasoning",
                "No reasoning provided.",
            )
        ).strip()

        if not reasoning:
            reasoning = "Insufficient evidence for a specific diagnosis."

        return Diagnosis(
            failure_code=failure_code,
            confidence=confidence,
            reasoning=reasoning,
            method="llm",
        )

    except requests.exceptions.RequestException:
        # Cloud deployment may not have access to local Ollama.
        # Fail safely instead of crashing the payment recovery API.
        return Diagnosis(
            failure_code=FailureCode.UNKNOWN,
            confidence=0.0,
            reasoning="LLM service unavailable; unable to determine failure reason.",
            method="llm",
        )

    except (json.JSONDecodeError, ValueError, TypeError, KeyError):
        # Invalid or unexpected LLM response.
        return Diagnosis(
            failure_code=FailureCode.UNKNOWN,
            confidence=0.0,
            reasoning="LLM response could not be interpreted safely.",
            method="llm",
        )

    except Exception:
        # Final safety fallback.
        return Diagnosis(
            failure_code=FailureCode.UNKNOWN,
            confidence=0.0,
            reasoning="Diagnosis failed safely due to an unexpected LLM error.",
            method="llm",
        )