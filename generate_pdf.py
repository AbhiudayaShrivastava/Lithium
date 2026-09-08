"""
Lithium Autonomous Operations Platform — PDF Feature & Roadmap Generator
Generates a clean 2-page executive PDF summary using ReportLab.
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

PDF_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Lithium_Features_Overview.pdf")


def build_pdf():
    # Tightened margins to fit cleanly on exactly 2 pages
    doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=letter,
        leftMargin=28,
        rightMargin=28,
        topMargin=26,
        bottomMargin=26
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0f172a')
    )
    
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#0284c7')
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#64748b')
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=7,
        spaceAfter=4
    )

    feature_title = ParagraphStyle(
        'FeatTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0369a1')
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#334155')
    )

    table_header = ParagraphStyle(
        'TH',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0f172a')
    )

    table_cell = ParagraphStyle(
        'TD',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#1e293b')
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#334155'),
        leftIndent=10
    )

    story = []

    # =========================================================================
    # PAGE 1: Header & Architecture Summary
    # =========================================================================
    header_data = [
        [
            Paragraph("<b>⚡ LITHIUM OPERATIONS PLATFORM</b>", title_style),
            Paragraph("<b>PS 5 — Resonance 1.0</b> | SCOPE, VIT Chennai<br/>Status: <b>Phase 1 Complete</b> | DB: <b>SQLite 3 WAL</b>", meta_style)
        ],
        [
            Paragraph("Autonomous Operations Intelligence Desk & Digital Twin Engine", subtitle_style),
            Paragraph("Confidential — Feature Specification & Roadmap Document", meta_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[360, 196])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceBefore=3, spaceAfter=5))

    # Architecture Summary
    story.append(Paragraph("1. System Architecture Overview", h1_style))
    arch_data = [
        [Paragraph("Layer", table_header), Paragraph("Technology Stack", table_header), Paragraph("Core Responsibility & Architecture Role", table_header)],
        [Paragraph("<b>Frontend UI</b>", table_cell), Paragraph("Vanilla JS, Tailwind CSS, HTML5 Canvas", table_cell), Paragraph("Reactive SRE dashboard, dynamic topology graph, time-horizon scrubber, and live SSE stream.", table_cell)],
        [Paragraph("<b>Backend API</b>", table_cell), Paragraph("FastAPI, Uvicorn, asyncio, Python 3.13", table_cell), Paragraph("Real-time telemetry engine, chaos injector, safety kill-switch, and REST API.", table_cell)],
        [Paragraph("<b>Database</b>", table_cell), Paragraph("SQLite 3 with WAL (Write-Ahead Logging)", table_cell), Paragraph("High-concurrency persistence for incidents, immutable audit ledgers, and post-mortems.", table_cell)],
        [Paragraph("<b>ML & AI</b>", table_cell), Paragraph("IsolationForest + Google Gemini 2.5", table_cell), Paragraph("Telemetry anomaly scoring with heuristic fallbacks and automated senior SRE PIR reports.", table_cell)]
    ]
    arch_table = Table(arch_data, colWidths=[75, 175, 306])
    arch_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(arch_table)

    # 12 Implemented Features
    story.append(Paragraph("2. Complete Feature Matrix (Currently Implemented & Live)", h1_style))
    features = [
        ("1. Real-Time System Health & KPIs", "Instant metrics for Overall Health (99.8%), Microservices Online (5/5), P99 Latency (32ms), and MTTR (16.2s) with live UTC clock and API connectivity badge."),
        ("2. Microservice Dependency Topology", "Custom HTML5 Canvas directed graph (Clients ➔ Gateway ➔ Auth ➔ Payments ➔ SQLite DB) with dynamic node coloring (Green/Red/Amber/Blue) and click drawer."),
        ("3. Chaos Injector & Outage Presets", "Instant triggers for Database Deadlock (DB_LOCK), Auth Memory Leak (OOM Kill), and DDoS Traffic Spikes with durable SQLite storage and dynamic blast radius updates."),
        ("4. Live Server Telemetry Controller", "Interactive [Input Server Data] modal allowing operators to customize the failing service, scrub exact Calculated Risk Rate (1–100), latency, and test playbooks."),
        ("5. Dual Autonomy Modes (Hybrid / Auto)", "Hybrid Autonomous mode requires human operator approval ([Approve & Execute Fix]). Full Autonomous mode runs a 2.0s countdown and auto-remediates zero-touch."),
        ("6. Safety Kill-Switch & Override", "Backend security interlock (POST /api/system/kill-switch) that rejects autonomous AI modifications with HTTP 403 Forbidden while manual override is active."),
        ("7. Digital Twin Time Scrubber (USP #1)", "Scrub forward into the future (0m to +30m) to inspect projected saturation cliffs up to 12 minutes in advance, with a one-click preemptive fix action."),
        ("8. Automated PIR & PDF Export (USP #2)", "AI post-mortem generation via Google Gemini with causal flow diagram (Root Cause ➔ Failure ➔ Remediation ➔ Recovery) and direct browser PDF download."),
        ("9. SQLite 3 WAL Persistence Layer", "Durable ACID storage in backend/lithium.db with WAL mode, persisting all active/resolved incidents, post-mortems, and an immutable audit ledger with JSON export."),
        ("10. Machine Learning Anomaly Detection", "Backend scikit-learn IsolationForest model trained on baseline telemetry to output real anomaly scores and confidence percentages via /api/digital-twin/telemetry."),
        ("11. Real-Time Telemetry Streaming (SSE)", "Server-Sent Events stream (/api/v1/telemetry/stream) broadcasting live metrics every 1.5s to an interactive terminal with category filters (LOGS, METRICS, SECURITY, CLOUD)."),
        ("12. Single-Click Launch Automation", "start.bat and run_app.bat scripts that verify environment, initialize SQLite WAL database, launch FastAPI on port 8000, launch web server on port 3000, and open the browser.")
    ]

    feat_data = [[Paragraph("Feature Name", table_header), Paragraph("Description & Engineering Implementation", table_header), Paragraph("Status", table_header)]]
    for name, desc in features:
        feat_data.append([
            Paragraph(f"<b>{name}</b>", feature_title),
            Paragraph(desc, body_style),
            Paragraph("<font color='#16a34a'><b>ACTIVE</b></font>", table_cell)
        ])

    feat_table = Table(feat_data, colWidths=[150, 350, 56])
    feat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(feat_table)

    # Clean Page Break between Page 1 and Page 2
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: Roadmap / Expansion Ideas & Team Guide
    # =========================================================================
    header_page2 = [
        [
            Paragraph("<b>⚡ LITHIUM OPERATIONS PLATFORM</b>", title_style),
            Paragraph("<b>Page 2 of 2</b><br/>Roadmap & Implementation Opportunities", meta_style)
        ]
    ]
    h2_table = Table(header_page2, colWidths=[380, 176])
    h2_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(h2_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceBefore=3, spaceAfter=6))

    story.append(Paragraph("3. Expansion Roadmap (What We Can Add Next)", h1_style))
    story.append(Paragraph(
        "These high-value feature concepts can be added next to maximize hackathon presentation points, "
        "impress judges, or prepare the platform for production deployment:",
        body_style
    ))
    story.append(Spacer(1, 4))

    ideas_data = [
        [Paragraph("Proposed Feature", table_header), Paragraph("Technical Scope & Description", table_header), Paragraph("Demo & Judging Impact", table_header)],
        [
            Paragraph("<b>1. AI SRE Copilot Chat Drawer</b>", feature_title),
            Paragraph("Slide-out interactive chat window where operators converse in natural language (e.g. <i>'Why did SQLite spike?'</i> or <i>'Roll back commit #8f3a'</i>), powered by Gemini AI with tool calling.", body_style),
            Paragraph("<b>Highest Impact</b><br/>Demonstrates conversational agentic AI for DevOps.", table_cell)
        ],
        [
            Paragraph("<b>2. Multi-Region / Cloud Switcher</b>", feature_title),
            Paragraph("Header dropdown allowing operators to toggle the operations desk between multiple cloud environments: AWS us-east-1, GCP europe-west3, and Azure Central India.", body_style),
            Paragraph("<b>High Impact</b><br/>Gives the platform an enterprise, multi-cloud scale feel.", table_cell)
        ],
        [
            Paragraph("<b>3. Simulated PagerDuty / Slack Webhooks</b>", feature_title),
            Paragraph("Notification toast module that triggers realistic webhook alerts into simulated Slack channels or PagerDuty on-call escalation policies when P1 incidents occur.", body_style),
            Paragraph("<b>High Impact</b><br/>Proves integration with standard SRE workflows.", table_cell)
        ],
        [
            Paragraph("<b>4. Financial Loss & Downtime Counter</b>", feature_title),
            Paragraph("Live dynamic ticker on the incident banner showing <i>'Estimated Downtime Cost Avoided: $1,420/min'</i>, dynamically calculating ROI saved by the self-healing engine.", body_style),
            Paragraph("<b>High Impact</b><br/>Compelling business and ROI presentation for judges.", table_cell)
        ],
        [
            Paragraph("<b>5. Custom Playbook Script Editor</b>", feature_title),
            Paragraph("Configuration view allowing SREs to upload or edit custom Bash/Python remediation scripts tied to specific microservice failure signatures.", body_style),
            Paragraph("<b>Medium Impact</b><br/>Demonstrates flexibility for custom enterprise stacks.", table_cell)
        ],
        [
            Paragraph("<b>6. Audio Sound Effects & Voice Alerts</b>", feature_title),
            Paragraph("Subtle audio cues: a sci-fi klaxon sound during incident injection and a positive audio chime when self-healing restores cluster health.", body_style),
            Paragraph("<b>Stage Presence</b><br/>Captures immediate audience attention in live demos.", table_cell)
        ]
    ]

    ideas_table = Table(ideas_data, colWidths=[140, 276, 140])
    ideas_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(ideas_table)
    story.append(Spacer(1, 10))

    # Team Quick Start Guide
    story.append(Paragraph("4. Quick Start Guide for Team Members", h1_style))
    story.append(Paragraph("<b>• Zero Setup Needed:</b> All Python dependencies (FastAPI, Uvicorn, Scikit-learn, Google-GenAI, ReportLab) are installed.", bullet_style))
    story.append(Paragraph("<b>• Single-Click Run:</b> Double-click <b>start.bat</b> in the project root to launch both the backend API and frontend dashboard.", bullet_style))
    story.append(Paragraph("<b>• Backend Engine:</b> Running on <b>http://localhost:8000</b> (Interactive API Docs: <b>http://localhost:8000/docs</b>).", bullet_style))
    story.append(Paragraph("<b>• Frontend Dashboard:</b> Running on <b>http://localhost:3000</b> (Auto-connects to backend with live status badge).", bullet_style))
    story.append(Paragraph("<b>• SQLite Database:</b> Located at <b>backend/lithium.db</b> (WAL mode enabled, durable across restarts).", bullet_style))
    story.append(Spacer(1, 8))

    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceBefore=4, spaceAfter=6))
    story.append(Paragraph("<i>⚡ Lithium Autonomous Operations Platform • Confidential Team & Hackathon Specification Document</i>", meta_style))

    doc.build(story)
    print(f"PDF Successfully Generated at: {PDF_PATH}")


if __name__ == "__main__":
    build_pdf()
