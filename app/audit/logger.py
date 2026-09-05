import json
from pathlib import Path

from app.data.models import AuditRecord


AUDIT_FILE = Path("audit_log.json")


def save_audit_record(record: AuditRecord) -> None:
    """Append one audit record to the JSON audit log."""

    records = []

    if AUDIT_FILE.exists():
        try:
            with open(AUDIT_FILE, "r", encoding="utf-8") as file:
                records = json.load(file)
        except json.JSONDecodeError:
            records = []

    records.append(record.model_dump(mode="json"))

    with open(AUDIT_FILE, "w", encoding="utf-8") as file:
        json.dump(records, file, indent=2)


def load_audit_records() -> list[dict]:
    """Load all audit records from the JSON audit log."""

    if not AUDIT_FILE.exists():
        return []

    with open(AUDIT_FILE, "r", encoding="utf-8") as file:
        return json.load(file)