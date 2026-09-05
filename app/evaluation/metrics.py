from dataclasses import dataclass

from app.data.models import (
    Decision,
    DecisionRecord,
    ExecutionResult,
    PaymentEvent,
)


@dataclass
class EvaluationMetrics:
    total_events: int
    total_revenue_at_risk_cents: int
    recovered_revenue_cents: int
    recovery_rate: float
    successful_recoveries: int
    recovery_attempts: int
    wasted_attempts: int
    compliance_overrides: int
    missed_recoverable_events: int

    @property
    def recovery_rate_percent(self) -> float:
        return self.recovery_rate * 100

    @property
    def recovered_revenue_rupees(self) -> float:
        return self.recovered_revenue_cents / 100

    @property
    def revenue_at_risk_rupees(self) -> float:
        return self.total_revenue_at_risk_cents / 100


def calculate_metrics(
    events: list[PaymentEvent],
    executions: list[ExecutionResult],
    decisions: list[DecisionRecord] | None = None,
) -> EvaluationMetrics:

    total_events = len(events)

    total_revenue_at_risk_cents = sum(
        event.amount_cents
        for event in events
    )

    recovered_revenue_cents = sum(
        execution.amount_recovered_cents
        for execution in executions
    )

    successful_recoveries = sum(
        1
        for execution in executions
        if execution.success
    )

    recovery_attempts = sum(
        1
        for execution in executions
        if execution.action_taken != Decision.STOP
    )

    wasted_attempts = sum(
        1
        for execution in executions
        if execution.action_taken != Decision.STOP
        and not execution.success
    )

    compliance_overrides = 0

    if decisions:
        compliance_overrides = sum(
            1
            for decision in decisions
            if decision.compliance_override
        )

    # A payment is considered recoverable in our environment
    # if at least one bounded recovery action has a non-zero
    # success probability.
    recoverable_events = 0

    for event in events:
        true_reason = event.metadata.get("true_failure_reason")

        if true_reason in {
            "card_declined",
            "insufficient_funds",
            "expired_card",
            "processor_error",
        }:
            recoverable_events += 1

    successful_event_ids = {
        execution.event_id
        for execution in executions
        if execution.success
    }

    missed_recoverable_events = sum(
        1
        for event in events
        if event.event_id not in successful_event_ids
        and event.metadata.get("true_failure_reason")
        in {
            "card_declined",
            "insufficient_funds",
            "expired_card",
            "processor_error",
        }
    )

    if total_revenue_at_risk_cents > 0:
        recovery_rate = (
            recovered_revenue_cents
            / total_revenue_at_risk_cents
        )
    else:
        recovery_rate = 0.0

    return EvaluationMetrics(
        total_events=total_events,
        total_revenue_at_risk_cents=total_revenue_at_risk_cents,
        recovered_revenue_cents=recovered_revenue_cents,
        recovery_rate=recovery_rate,
        successful_recoveries=successful_recoveries,
        recovery_attempts=recovery_attempts,
        wasted_attempts=wasted_attempts,
        compliance_overrides=compliance_overrides,
        missed_recoverable_events=missed_recoverable_events,
    )