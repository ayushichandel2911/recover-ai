import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Brain,
  Check,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Webhook,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SCENARIOS = {
  "51": {
    name: "Insufficient Funds",
    description: "Customer balance insufficient",
    amount: 149900,
  },
  "54": {
    name: "Expired Card",
    description: "Card validity expired",
    amount: 99900,
  },
  "62": {
    name: "Stolen Card Suspected",
    description: "Fraud risk detected",
    amount: 249900,
  },
  "91": {
    name: "Processor Error",
    description: "Issuer temporarily unavailable",
    amount: 499900,
  },
  "05": {
    name: "Card Declined",
    description: "Generic issuer decline",
    amount: 99900,
  },
  "96": {
    name: "Unknown Network Issue",
    description: "Unmapped processor failure",
    amount: 199900,
  },
};

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function moneyCents(value) {
  return money(Number(value || 0) / 100);
}

function number(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function title(value) {
  if (!value) return "—";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function App() {
  const [metrics, setMetrics] = useState(null);
  const [auditRecords, setAuditRecords] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState("54");
  const [recoveryResult, setRecoveryResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [activeNav, setActiveNav] = useState("Overview");

  async function loadMetrics() {
    try {
      setLoading(true);
      const response = await fetch(`${API}/evaluate`);
      if (!response.ok) throw new Error("Unable to load evaluation");

      const data = await response.json();
      setMetrics(data);
      setApiError("");
    } catch (error) {
      console.error("Metrics error:", error);
      setApiError("Unable to connect to RecoverAI API");
    } finally {
      setLoading(false);
    }
  }

  async function loadAudit() {
    try {
      setAuditLoading(true);
      const response = await fetch(`${API}/audit`);
      if (!response.ok) throw new Error("Unable to load audit");

      const data = await response.json();
      setAuditRecords(data.records || []);
    } catch (error) {
      console.error("Audit error:", error);
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    loadMetrics();
    loadAudit();
  }, []);

  async function runRecovery() {
    try {
      setRecoveryLoading(true);
      setRecoveryResult(null);

      const scenario = SCENARIOS[selectedScenario];

      const event = {
        event_id: `live_demo_${Date.now()}`,
        customer_id: "demo_customer",
        amount_cents: scenario.amount,
        currency: "inr",
        raw_bank_code: selectedScenario,
        attempt_number: 1,
        customer_opted_out: false,
        created_at: new Date().toISOString(),
        metadata: {},
      };

      const response = await fetch(`${API}/payments/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });

      if (!response.ok) throw new Error("Recovery request failed");

      const data = await response.json();
      setRecoveryResult(data);
      await loadAudit();
    } catch (error) {
      console.error("Recovery error:", error);
      setRecoveryResult({ error: error.message });
    } finally {
      setRecoveryLoading(false);
    }
  }

  const baseline = metrics?.baseline || {};
  const ai = metrics?.recover_ai || {};

  const improvement =
    Number(ai.recovery_rate_percent || 0) -
    Number(baseline.recovery_rate_percent || 0);

  const additionalRevenue =
    Number(ai.recovered_revenue_rupees || 0) -
    Number(baseline.recovered_revenue_rupees || 0);

  const currentScenario = SCENARIOS[selectedScenario];

  const selectedResult =
    recoveryResult && !recoveryResult.error ? recoveryResult : null;

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingCard}>
          <div style={styles.logoLarge}>
            <Zap size={25} />
          </div>

          <div style={styles.spinner}>
            <RefreshCw size={18} className="spin" />
          </div>

          <h2 style={{ margin: "18px 0 6px" }}>RecoverAI</h2>

          <p style={{ color: "#8b93a7", margin: 0 }}>
            Loading recovery intelligence…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>
            <Zap size={20} />
          </div>

          <div>
            <div style={styles.brandName}>RecoverAI</div>
            <div style={styles.brandSub}>REVENUE RECOVERY</div>
          </div>
        </div>

        <div style={styles.navLabel}>WORKSPACE</div>

        {[
          [LayoutDashboard, "Overview"],
          [Activity, "Recovery Console"],
          [CircleDollarSign, "Revenue"],
          [FileText, "Audit Trail"],
        ].map(([Icon, label]) => (
          <button
            key={label}
            onClick={() => {
              setActiveNav(label);

              if (label === "Recovery Console") {
                document
                  .getElementById("console")
                  ?.scrollIntoView({ behavior: "smooth" });
              }

              if (label === "Audit Trail") {
                document
                  .getElementById("audit")
                  ?.scrollIntoView({ behavior: "smooth" });
              }

              if (label === "Revenue") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            style={{
              ...styles.navItem,
              ...(activeNav === label ? styles.navActive : {}),
            }}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}

        <div style={{ ...styles.navLabel, marginTop: 28 }}>SYSTEM</div>

        {[
          [Webhook, "Webhooks"],
          [ShieldCheck, "Compliance"],
          [Brain, "AI Engine"],
        ].map(([Icon, label]) => (
          <button
            key={label}
            onClick={() => setActiveNav(label)}
            style={styles.navItem}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}

        <div style={styles.sidebarBottom}>
          <div style={styles.systemDot} />

          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              All systems operational
            </div>

            <div
              style={{
                fontSize: 10,
                color: "#6e7890",
                marginTop: 3,
              }}
            >
              {apiError ? "API connection issue" : "API connected"}
            </div>
          </div>
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.topbar}>
          <div>
            <div style={styles.breadcrumb}>WORKSPACE / OVERVIEW</div>

            <h1 style={styles.pageTitle}>Revenue Recovery Dashboard</h1>

            <p style={styles.pageSub}>
              Autonomous payment recovery with compliance controls.
            </p>
          </div>

          <div style={styles.topRight}>
            <div style={styles.live}>
              <span style={styles.liveDot} /> LIVE SYSTEM
            </div>

            <div style={styles.avatar}>AI</div>
          </div>
        </header>

        <div style={styles.content}>
          {apiError && (
            <div style={styles.errorBanner}>
              <XCircle size={15} />

              {apiError}. Make sure the backend is running on port 8000.

              <button onClick={loadMetrics}>Retry</button>
            </div>
          )}

          <section style={styles.hero}>
            <div style={styles.heroGlow} />

            <div style={{ position: "relative", zIndex: 2, maxWidth: 690 }}>
              <div style={styles.eyebrow}>
                <Sparkles size={14} /> AI REVENUE RECOVERY AGENT
              </div>

              <h2 style={styles.heroTitle}>
                Turn failed payments into
                <span style={styles.heroAccent}> recovered revenue.</span>
              </h2>

              <p style={styles.heroText}>
                RecoverAI detects payment failures, diagnoses their root cause,
                chooses the safest intervention, enforces compliance, and
                measures the money actually recovered.
              </p>

              <div className="heroPills" style={styles.heroPills}>
                <span>
                  <ShieldCheck size={14} /> Compliance-first
                </span>

                <span>
                  <Zap size={14} /> Bounded actions
                </span>

                <span>
                  <TrendingUp size={14} /> Measured outcomes
                </span>
              </div>
            </div>

            <div style={styles.heroValue}>
              <div style={styles.heroValueLabel}>REVENUE AT RISK</div>

              <div style={styles.heroMoney}>
                {money(
                  ai.revenue_at_risk_rupees ||
                    baseline.revenue_at_risk_rupees
                )}
              </div>

              <div style={styles.heroSmall}>
                {number(metrics?.events)} failed payment events
              </div>
            </div>
          </section>

          <section style={styles.metricGrid}>
            <Metric
              icon={<TrendingUp />}
              label="Recovery rate"
              value={`${Number(ai.recovery_rate_percent || 0).toFixed(2)}%`}
              sub={`+${improvement.toFixed(2)} pp vs baseline`}
              positive
            />

            <Metric
              icon={<CircleDollarSign />}
              label="Revenue recovered"
              value={money(ai.recovered_revenue_rupees)}
              sub={`vs ${money(
                baseline.recovered_revenue_rupees
              )} baseline`}
            />

            <Metric
              icon={<ArrowUpRight />}
              label="Incremental revenue"
              value={money(additionalRevenue)}
              sub="additional value recovered"
              positive
            />

            <Metric
              icon={<ShieldCheck />}
              label="Protected events"
              value={number(ai.compliance_overrides)}
              sub="unsafe actions blocked"
            />
          </section>

          <section style={styles.sectionHeader}>
            <div>
              <div style={styles.kicker}>PERFORMANCE</div>

              <h2 style={styles.sectionTitle}>
                Recovery intelligence
              </h2>

              <p style={styles.sectionSub}>
                How the agent performs against a fixed retry-later baseline.
              </p>
            </div>

            <button onClick={loadMetrics} style={styles.ghostButton}>
              <RefreshCw size={14} className={loading ? "spin" : ""} />
              Refresh
            </button>
          </section>

          <section style={styles.performanceGrid}>
            <div style={styles.card}>
              <CardTitle
                icon={<TrendingUp size={17} />}
                title="Recovery performance"
                sub="Simulated 1,000-payment evaluation"
              />

              <div style={styles.rateRow}>
                <div
                  style={{
                    ...styles.rateCircle,
                    background: `conic-gradient(#635bff ${
                      Math.min(
                        Number(ai.recovery_rate_percent || 0),
                        100
                      )
                    }%, #edeaff 0)`,
                  }}
                >
                  <div>
                    <strong>
                      {Number(
                        ai.recovery_rate_percent || 0
                      ).toFixed(1)}
                      %
                    </strong>

                    <span>RECOVERED</span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <Bar
                    label="RecoverAI"
                    value={Number(ai.recovery_rate_percent || 0)}
                    primary
                  />

                  <Bar
                    label="Baseline"
                    value={Number(
                      baseline.recovery_rate_percent || 0
                    )}
                  />

                  <div style={styles.impact}>
                    <ArrowUpRight size={15} />

                    <span>
                      <b>+{improvement.toFixed(2)} pp</b>{" "}
                      improvement over baseline
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <CardTitle
                icon={<Activity size={17} />}
                title="Recovery activity"
                sub="Current agent operating statistics"
              />

              <div style={styles.activityList}>
                <ActivityRow
                  icon={<Activity />}
                  label="Recovery attempts"
                  value={number(ai.recovery_attempts)}
                />

                <ActivityRow
                  icon={<XCircle />}
                  label="Wasted attempts"
                  value={number(ai.wasted_attempts)}
                />

                <ActivityRow
                  icon={<ShieldCheck />}
                  label="Compliance overrides"
                  value={number(ai.compliance_overrides)}
                />

                <ActivityRow
                  icon={<CircleDollarSign />}
                  label="Recovered revenue"
                  value={money(ai.recovered_revenue_rupees)}
                />
              </div>
            </div>
          </section>

          <section id="console" style={{ marginTop: 34 }}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.kicker}>LIVE AGENT</div>

                <h2 style={styles.sectionTitle}>
                  Recovery console
                </h2>

                <p style={styles.sectionSub}>
                  Run a failure through Diagnose → Decide → Protect →
                  Execute.
                </p>
              </div>

              <div style={styles.demoBadge}>
                <span /> DEMO ENVIRONMENT
              </div>
            </div>

            <div style={styles.consoleGrid}>
              <div style={styles.card}>
                <CardTitle
                  icon={<Zap size={17} />}
                  title="Payment failure"
                  sub="Choose an event to send to the agent"
                />

                <div style={styles.scenarioGrid}>
                  {Object.entries(SCENARIOS).map(([code, scenario]) => (
                    <button
                      key={code}
                      onClick={() => {
                        setSelectedScenario(code);
                        setRecoveryResult(null);
                      }}
                      style={{
                        ...styles.scenario,
                        ...(selectedScenario === code
                          ? styles.scenarioSelected
                          : {}),
                      }}
                    >
                      <div style={styles.scenarioTop}>
                        <span style={styles.codeBadge}>{code}</span>

                        <span style={styles.scenarioAmount}>
                          {moneyCents(scenario.amount)}
                        </span>
                      </div>

                      <div style={styles.scenarioName}>
                        {scenario.name}
                      </div>

                      <div style={styles.scenarioDesc}>
                        {scenario.description}
                      </div>
                    </button>
                  ))}
                </div>

                <div style={styles.selectedPreview}>
                  <div>
                    <span style={styles.miniLabel}>
                      SELECTED EVENT
                    </span>

                    <strong>{currentScenario.name}</strong>
                  </div>

                  <strong style={{ fontSize: 18 }}>
                    {moneyCents(currentScenario.amount)}
                  </strong>
                </div>

                <button
                  onClick={runRecovery}
                  disabled={recoveryLoading}
                  style={styles.runButton}
                  className="runButton"
                >
                  {recoveryLoading ? (
                    <RefreshCw size={17} className="spin" />
                  ) : (
                    <Zap size={17} />
                  )}

                  {recoveryLoading
                    ? "Agent is processing…"
                    : "Run Recovery Agent"}
                </button>
              </div>

              <div style={styles.card}>
                <CardTitle
                  icon={<Brain size={17} />}
                  title="Agent decision"
                  sub="Live decision trace"
                />

                {!selectedResult ? (
                  <div style={styles.emptyConsole}>
                    <div style={styles.aiOrb}>
                      <Sparkles size={24} />
                    </div>

                    <h3>Ready for a recovery decision</h3>

                    <p>
                      Select a payment failure and run the agent to see
                      its reasoning and compliance outcome.
                    </p>

                    <div style={styles.pipelinePreview}>
                      {["Diagnose", "Decide", "Protect", "Execute"].map(
                        (x, i) => (
                          <div key={x}>
                            <span>{i + 1}</span>
                            {x}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={styles.liveResultBanner}>
                      <div style={styles.successIcon}>
                        {selectedResult.execution?.success ? (
                          <Check size={17} />
                        ) : (
                          <X size={17} />
                        )}
                      </div>

                      <div>
                        <strong>
                          {selectedResult.execution?.success
                            ? "Recovery successful"
                            : "Recovery action completed"}
                        </strong>

                        <span>
                          {selectedResult.execution?.success
                            ? "Revenue recovered"
                            : "No revenue recovered in simulation"}
                        </span>
                      </div>

                      <strong
                        style={{
                          marginLeft: "auto",
                          fontSize: 20,
                        }}
                      >
                        {moneyCents(
                          selectedResult.execution
                            ?.amount_recovered_cents
                        )}
                      </strong>
                    </div>

                    <div style={styles.trace}>
                      <TraceStep
                        n="01"
                        label="DIAGNOSE"
                        value={title(
                          selectedResult.diagnosis?.failure_code
                        )}
                        detail={`${Math.round(
                          (selectedResult.diagnosis?.confidence || 0) *
                            100
                        )}% confidence`}
                      />

                      <TraceStep
                        n="02"
                        label="DECIDE"
                        value={title(
                          selectedResult.decision?.decision
                        )}
                        detail={selectedResult.decision?.reason}
                      />

                      <TraceStep
                        n="03"
                        label="PROTECT"
                        value={
                          selectedResult.decision
                            ?.compliance_override
                            ? "Action blocked"
                            : "Action permitted"
                        }
                        detail={
                          selectedResult.decision
                            ?.compliance_override
                            ? "Compliance firewall enforced."
                            : "No compliance rule triggered."
                        }
                        blocked={
                          selectedResult.decision
                            ?.compliance_override
                        }
                      />

                      <TraceStep
                        n="04"
                        label="EXECUTE"
                        value={title(
                          selectedResult.execution?.action_taken
                        )}
                        detail={
                          selectedResult.execution?.success
                            ? "Simulated recovery succeeded."
                            : "Simulated action did not recover revenue."
                        }
                      />
                    </div>

                    <div style={styles.auditConfirmed}>
                      <CheckCircle2 size={15} />
                      DECISION LOGGED TO AUDIT TRAIL
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section id="audit" style={{ marginTop: 34 }}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.kicker}>TRACEABILITY</div>

                <h2 style={styles.sectionTitle}>
                  Recent recovery events
                </h2>

                <p style={styles.sectionSub}>
                  Every diagnosis, decision, protection rule and
                  execution is recorded.
                </p>
              </div>

              <button onClick={loadAudit} style={styles.ghostButton}>
                <RefreshCw
                  size={14}
                  className={auditLoading ? "spin" : ""}
                />
                Refresh
              </button>
            </div>

            <div style={styles.auditCard}>
              {auditRecords.length === 0 ? (
                <div style={styles.emptyAudit}>
                  <FileText size={28} />

                  <strong>No recovery events yet</strong>

                  <span>
                    Run the recovery agent above to create an audit
                    record.
                  </span>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>EVENT</th>
                        <th>DIAGNOSIS</th>
                        <th>ACTION</th>
                        <th>COMPLIANCE</th>
                        <th>RESULT</th>
                        <th>RECOVERED AMOUNT</th>
                      </tr>
                    </thead>

                    <tbody>
                      {[...auditRecords]
                        .reverse()
                        .slice(0, 8)
                        .map((record, index) => {
                          const blocked =
                            record.decision?.compliance_override;

                          const success =
                            record.execution?.success;

                          const recoveredAmount =
                            Number(
                              record.execution
                                ?.amount_recovered_cents || 0
                            );

                          return (
                            <tr
                              key={`${record.event_id}-${index}`}
                            >
                              <td>
                                <strong>{record.event_id}</strong>

                                <small>
                                  {record.timestamp
                                    ? new Date(
                                        record.timestamp
                                      ).toLocaleTimeString()
                                    : "—"}
                                </small>
                              </td>

                              <td>
                                {title(
                                  record.diagnosis?.failure_code
                                )}
                              </td>

                              <td>
                                <span style={styles.actionBadge}>
                                  {title(
                                    record.decision?.decision
                                  )}
                                </span>
                              </td>

                              <td>
                                <span
                                  style={
                                    blocked
                                      ? styles.badgeRed
                                      : styles.badgeGreen
                                  }
                                >
                                  {blocked ? "BLOCKED" : "ALLOWED"}
                                </span>
                              </td>

                              <td>
                                {success ? (
                                  <span
                                    style={
                                      styles.successResult
                                    }
                                  >
                                    <CheckCircle2 size={13} />
                                    Success
                                  </span>
                                ) : (
                                  <span
                                    style={
                                      styles.failedResult
                                    }
                                  >
                                    <XCircle size={13} />
                                    Failed
                                  </span>
                                )}
                              </td>

                              <td>
                                <strong
                                  style={{
                                    color: success
                                      ? "#15803d"
                                      : "#8b95a8",
                                  }}
                                >
                                  {success
                                    ? moneyCents(recoveredAmount)
                                    : "—"}
                                </strong>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section style={styles.workflowCard}>
            <div>
              <div style={styles.kicker}>
                CONTROLLED AUTONOMY
              </div>

              <h2 style={styles.workflowTitle}>
                Built to recover revenue without bypassing safety.
              </h2>

              <p style={styles.workflowSub}>
                The agent can optimize recovery actions, but compliance
                rules always have the final say.
              </p>
            </div>

            <div style={styles.workflowSteps}>
              {[
                ["01", "Diagnose", "Identify the likely failure cause."],
                ["02", "Decide", "Choose the safest recovery action."],
                ["03", "Protect", "Apply hard compliance constraints."],
                ["04", "Execute", "Run a bounded recovery action."],
                ["05", "Audit", "Record the complete decision trail."],
              ].map(([n, t, d]) => (
                <div key={n} style={styles.workflowStep}>
                  <span>{n}</span>

                  <strong>{t}</strong>

                  <p>{d}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.complianceCard}>
            <div style={styles.complianceIcon}>
              <ShieldCheck size={24} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={styles.kicker}>
                COMPLIANCE FIREWALL
              </div>

              <h3
                style={{
                  margin: "5px 0",
                  fontSize: 19,
                  color: "#182033",
                }}
              >
                Safety rules cannot be overridden by the agent.
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "#7c869c",
                  lineHeight: 1.6,
                  fontSize: 13,
                }}
              >
                Customer opt-outs and suspected stolen cards are
                automatically blocked before recovery execution.
              </p>
            </div>

            <div style={styles.checkList}>
              <span>
                <CheckCircle2 size={14} /> Opt-out respected
              </span>

              <span>
                <CheckCircle2 size={14} /> Stolen-card recovery blocked
              </span>

              <span>
                <CheckCircle2 size={14} /> Every action audited
              </span>
            </div>
          </section>

          <footer style={styles.footer}>
            <span>
              <b>RecoverAI</b> · AI Revenue Recovery Agent
            </span>

            <span>Built for Razorpay AI Buildathon 2026</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon, label, value, sub, positive }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricIcon}>{icon}</div>

      <div style={styles.metricLabel}>{label}</div>

      <div style={styles.metricValue}>{value}</div>

      <div
        style={{
          ...styles.metricSub,
          color: positive ? "#16a34a" : "#8a94a8",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function CardTitle({ icon, title, sub }) {
  return (
    <div style={styles.cardTitle}>
      <div style={styles.cardIcon}>{icon}</div>

      <div>
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
    </div>
  );
}

function Bar({ label, value, primary }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={styles.barLabel}>
        <span>{label}</span>
        <strong>{value.toFixed(2)}%</strong>
      </div>

      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${Math.min(value, 100)}%`,
            ...(primary ? styles.barPrimary : {}),
          }}
        />
      </div>
    </div>
  );
}

function ActivityRow({ icon, label, value }) {
  return (
    <div style={styles.activityRow}>
      <div style={styles.activityLabel}>
        {icon}
        {label}
      </div>

      <strong>{value}</strong>
    </div>
  );
}

function TraceStep({ n, label, value, detail, blocked }) {
  return (
    <div className="traceStep" style={styles.traceStep}>
      <div
        style={{
          ...styles.traceNumber,
          ...(blocked ? styles.traceBlocked : {}),
        }}
      >
        {n}
      </div>

      <div style={{ flex: 1 }}>
        <div style={styles.traceLabel}>{label}</div>

        <strong
          style={{
            color: blocked ? "#dc2626" : "#182033",
          }}
        >
          {value}
        </strong>

        <p>{detail}</p>
      </div>

      {blocked ? (
        <XCircle size={18} color="#dc2626" />
      ) : (
        <CheckCircle2 size={18} color="#16a34a" />
      )}
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#f4f6fb",
  },

  loadingScreen: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0b1020",
  },

  loadingCard: {
    textAlign: "center",
    color: "#fff",
  },

  logoLarge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    margin: "0 auto",
    background: "linear-gradient(135deg,#635bff,#8b5cf6)",
    boxShadow: "0 16px 40px rgba(99,91,255,.35)",
  },

  spinner: {
    marginTop: 20,
    color: "#a5b4fc",
  },

  sidebar: {
    width: 250,
    background: "#0b1020",
    color: "#fff",
    position: "fixed",
    inset: "0 auto 0 0",
    zIndex: 10,
    padding: "24px 15px",
    display: "flex",
    flexDirection: "column",
  },

  brand: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: "5px 10px 30px",
  },

  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "linear-gradient(135deg,#635bff,#8b5cf6)",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 12px 28px rgba(99,91,255,.3)",
  },

  brandName: {
    fontWeight: 850,
    fontSize: 18,
    letterSpacing: "-.5px",
  },

  brandSub: {
    color: "#737e96",
    fontSize: 9,
    letterSpacing: 1.2,
    marginTop: 3,
    fontWeight: 700,
  },

  navLabel: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1.3,
    color: "#606b83",
    padding: "0 12px 9px",
  },

  navItem: {
    border: 0,
    background: "transparent",
    color: "#9ba5bb",
    width: "100%",
    padding: "11px 12px",
    borderRadius: 10,
    display: "flex",
    gap: 11,
    alignItems: "center",
    cursor: "pointer",
    textAlign: "left",
    fontSize: 12,
    marginBottom: 3,
  },

  navActive: {
    background:
      "linear-gradient(90deg,rgba(99,91,255,.22),rgba(99,91,255,.08))",
    color: "#fff",
    boxShadow: "inset 3px 0 #7468ff",
  },

  sidebarBottom: {
    marginTop: "auto",
    borderTop: "1px solid #1d263a",
    padding: "18px 10px 4px",
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  systemDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 0 4px rgba(34,197,94,.1)",
  },

  main: {
    marginLeft: 250,
    minHeight: "100vh",
  },

  topbar: {
    height: 88,
    background: "rgba(255,255,255,.96)",
    borderBottom: "1px solid #e8ebf1",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 38px",
    position: "sticky",
    top: 0,
    zIndex: 8,
    backdropFilter: "blur(14px)",
  },

  breadcrumb: {
    color: "#8d96a8",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1.1,
    marginBottom: 5,
  },

  pageTitle: {
    margin: 0,
    fontSize: 16,
    letterSpacing: "-.3px",
    color: "#182033",
    fontWeight: 800,
  },

  pageSub: {
    margin: "5px 0 0",
    color: "#8b95a8",
    fontSize: 11,
  },

  topRight: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  live: {
    border: "1px solid #d6f0df",
    background: "#f4fcf6",
    color: "#16803c",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 10,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 7,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 0 4px rgba(34,197,94,.1)",
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 11,
    background: "linear-gradient(135deg,#635bff,#a855f7)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 850,
    fontSize: 11,
  },

  content: {
    maxWidth: 1420,
    margin: "0 auto",
    padding: "28px 38px 55px",
  },

  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    background: "#fff4f4",
    border: "1px solid #ffd8d8",
    color: "#b42318",
    borderRadius: 11,
    padding: "11px 13px",
    marginBottom: 14,
    fontSize: 10,
    fontWeight: 700,
  },

  hero: {
    minHeight: 255,
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: "38px 40px",
    color: "#fff",
    background:
      "linear-gradient(135deg,#111936 0%,#182043 55%,#21184c 100%)",
    boxShadow: "0 18px 45px rgba(20,25,55,.13)",
    display: "flex",
    alignItems: "center",
  },

  heroGlow: {
    position: "absolute",
    width: 440,
    height: 440,
    borderRadius: "50%",
    right: -150,
    top: -210,
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow:
      "0 0 0 70px rgba(255,255,255,.015),0 0 0 140px rgba(255,255,255,.012)",
  },

  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    color: "#b8b4ff",
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: 1,
    marginBottom: 13,
  },

  heroTitle: {
    margin: 0,
    fontSize: 39,
    lineHeight: 1.08,
    letterSpacing: "-1.5px",
    maxWidth: 690,
  },

  heroAccent: {
    color: "#a99cff",
  },

  heroText: {
    color: "#aeb8d1",
    fontSize: 13,
    lineHeight: 1.75,
    maxWidth: 650,
    margin: "15px 0 18px",
  },

  heroPills: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  heroValue: {
    position: "absolute",
    right: 42,
    bottom: 40,
    textAlign: "right",
  },

  heroValueLabel: {
    color: "#7f8ba8",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1.2,
  },

  heroMoney: {
    fontSize: 31,
    fontWeight: 850,
    marginTop: 5,
    letterSpacing: "-1px",
  },

  heroSmall: {
    color: "#8793ae",
    fontSize: 10,
    marginTop: 3,
  },

  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 13,
    marginTop: 15,
  },

  metric: {
    background: "#fff",
    border: "1px solid #e7eaf0",
    borderRadius: 16,
    padding: 18,
    minHeight: 142,
    boxShadow: "0 6px 20px rgba(20,25,45,.035)",
  },

  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    background: "#f0efff",
    color: "#635bff",
    display: "grid",
    placeItems: "center",
    marginBottom: 18,
  },

  metricLabel: {
    color: "#7d879a",
    fontSize: 10,
    fontWeight: 700,
  },

  metricValue: {
    fontSize: 23,
    fontWeight: 850,
    marginTop: 6,
    letterSpacing: "-.7px",
    color: "#182033",
  },

  metricSub: {
    fontSize: 9,
    marginTop: 5,
    fontWeight: 700,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    margin: "34px 0 13px",
  },

  kicker: {
    fontSize: 9,
    color: "#7067e8",
    fontWeight: 850,
    letterSpacing: 1.2,
  },

  sectionTitle: {
    margin: "4px 0 0",
    fontSize: 20,
    letterSpacing: "-.5px",
    color: "#182033",
  },

  sectionSub: {
    margin: "5px 0 0",
    color: "#8b95a8",
    fontSize: 11,
  },

  ghostButton: {
    border: "1px solid #e0e4eb",
    background: "#fff",
    color: "#384154",
    borderRadius: 9,
    padding: "9px 12px",
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
  },

  performanceGrid: {
    display: "grid",
    gridTemplateColumns: "1.25fr .75fr",
    gap: 13,
  },

  card: {
    background: "#fff",
    border: "1px solid #e7eaf0",
    borderRadius: 17,
    padding: 21,
    boxShadow: "0 6px 20px rgba(20,25,45,.035)",
  },

  cardTitle: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    paddingBottom: 17,
    borderBottom: "1px solid #eef0f4",
  },

  cardIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,
    background: "#f0efff",
    color: "#635bff",
    display: "grid",
    placeItems: "center",
  },

  rateRow: {
    display: "flex",
    gap: 32,
    alignItems: "center",
    paddingTop: 24,
  },

  rateCircle: {
    width: 132,
    height: 132,
    flex: "0 0 132px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    position: "relative",
  },

  activityList: {
    paddingTop: 7,
  },

  activityRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "15px 0",
    borderBottom: "1px solid #eef0f4",
  },

  activityLabel: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: "#778195",
    fontSize: 11,
  },

  barLabel: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    fontWeight: 750,
    marginBottom: 7,
  },

  barTrack: {
    height: 7,
    borderRadius: 99,
    background: "#edf0f5",
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    borderRadius: 99,
    background: "#b9bfca",
    transition: "width .5s ease",
  },

  barPrimary: {
    background: "linear-gradient(90deg,#635bff,#8b5cf6)",
  },

  impact: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#f4f3ff",
    color: "#6259d6",
    borderRadius: 9,
    padding: "10px 12px",
    fontSize: 10,
    marginTop: 8,
  },

  demoBadge: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#776fe5",
    fontSize: 9,
    fontWeight: 850,
    border: "1px solid #dfdcff",
    background: "#f8f7ff",
    borderRadius: 999,
    padding: "7px 10px",
  },

  consoleGrid: {
    display: "grid",
    gridTemplateColumns: ".86fr 1.14fr",
    gap: 13,
  },

  scenarioGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: 9,
    paddingTop: 17,
  },

  scenario: {
    border: "1px solid #e7eaf0",
    background: "#fff",
    borderRadius: 12,
    padding: 12,
    textAlign: "left",
    cursor: "pointer",
    transition: "all .18s",
    minHeight: 105,
  },

  scenarioSelected: {
    border: "1px solid #6d64ff",
    background: "#f8f7ff",
    boxShadow: "0 0 0 3px rgba(99,91,255,.08)",
  },

  scenarioTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  codeBadge: {
    background: "#eef0f6",
    color: "#697388",
    borderRadius: 6,
    padding: "3px 6px",
    fontSize: 9,
    fontWeight: 850,
  },

  scenarioAmount: {
    fontSize: 10,
    fontWeight: 850,
  },

  scenarioName: {
    fontWeight: 800,
    fontSize: 11,
    marginTop: 11,
  },

  scenarioDesc: {
    color: "#8d96a8",
    fontSize: 9,
    marginTop: 4,
  },

  selectedPreview: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 13,
    background: "#f7f8fb",
    borderRadius: 11,
    padding: "11px 13px",
  },

  miniLabel: {
    display: "block",
    color: "#9199a9",
    fontSize: 8,
    fontWeight: 850,
    letterSpacing: 0.9,
    marginBottom: 3,
  },

  runButton: {
    width: "100%",
    border: 0,
    borderRadius: 11,
    padding: "13px",
    marginTop: 10,
    background: "linear-gradient(135deg,#5b52ed,#844cf0)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(99,91,255,.2)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  emptyConsole: {
    minHeight: 350,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    color: "#8c95a8",
    padding: 30,
  },

  aiOrb: {
    width: 58,
    height: 58,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#eeeaff,#f5efff)",
    color: "#685df0",
    marginBottom: 14,
  },

  pipelinePreview: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 7,
    width: "100%",
    maxWidth: 470,
    marginTop: 22,
  },

  liveResultBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#f7faf8",
    border: "1px solid #dfeee4",
    borderRadius: 12,
    padding: 13,
    marginTop: 17,
  },

  successIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    background: "#e8f8ee",
    color: "#16a34a",
  },

  trace: {
    marginTop: 17,
  },

  traceStep: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "13px 0",
    borderBottom: "1px solid #eef0f4",
  },

  traceNumber: {
    width: 27,
    height: 27,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "#eeecff",
    color: "#635bff",
    fontSize: 9,
    fontWeight: 850,
    flex: "0 0 27px",
  },

  traceBlocked: {
    background: "#feecec",
    color: "#dc2626",
  },

  traceLabel: {
    color: "#8b94a7",
    fontSize: 8,
    fontWeight: 850,
    letterSpacing: 1,
    marginBottom: 3,
  },

  auditConfirmed: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#15803d",
    fontSize: 9,
    fontWeight: 850,
    marginTop: 14,
  },

  auditCard: {
    background: "#fff",
    border: "1px solid #e7eaf0",
    borderRadius: 17,
    overflow: "hidden",
    boxShadow: "0 6px 20px rgba(20,25,45,.035)",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 10,
  },

  emptyAudit: {
    minHeight: 220,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: "#8b95a8",
  },

  badgeGreen: {
    color: "#16803c",
    background: "#ebf9ef",
    padding: "5px 7px",
    borderRadius: 6,
    fontSize: 8,
    fontWeight: 850,
  },

  badgeRed: {
    color: "#dc2626",
    background: "#fff0f0",
    padding: "5px 7px",
    borderRadius: 6,
    fontSize: 8,
    fontWeight: 850,
  },

  actionBadge: {
    color: "#5148c8",
    background: "#f0efff",
    padding: "5px 8px",
    borderRadius: 6,
    fontSize: 8,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  successResult: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "#15803d",
    background: "#ebf9ef",
    padding: "5px 8px",
    borderRadius: 6,
    fontSize: 8,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  failedResult: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "#b42318",
    background: "#fff1f0",
    padding: "5px 8px",
    borderRadius: 6,
    fontSize: 8,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  mutedStatus: {
    color: "#8b95a8",
    fontSize: 9,
    fontWeight: 700,
  },

  workflowCard: {
    marginTop: 34,
    background: "#111936",
    color: "#fff",
    borderRadius: 18,
    padding: 25,
    display: "grid",
    gridTemplateColumns: ".8fr 1.2fr",
    gap: 30,
  },

  workflowTitle: {
    margin: "5px 0 0",
    fontSize: 19,
    lineHeight: 1.25,
    color: "#fff",
  },

  workflowSub: {
    margin: "7px 0 0",
    color: "#9da7bd",
    fontSize: 11,
    lineHeight: 1.6,
  },

  workflowSteps: {
    display: "grid",
    gridTemplateColumns: "repeat(5,1fr)",
    gap: 8,
  },

  workflowStep: {
    background: "rgba(255,255,255,.055)",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 11,
    padding: 12,
  },

  complianceCard: {
    marginTop: 13,
    background: "#fff",
    border: "1px solid #dfe9e2",
    borderRadius: 17,
    padding: 22,
    display: "flex",
    gap: 16,
    alignItems: "center",
  },

  complianceIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    background: "#ecf9f0",
    color: "#16803c",
    display: "grid",
    placeItems: "center",
  },

  checkList: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    color: "#16803c",
    fontSize: 9,
    fontWeight: 750,
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#929bad",
    fontSize: 9,
    padding: "28px 2px 5px",
  },
};

export default App;