#!/usr/bin/env python3
"""
HealthChain Report PDF Generator
Called by the backend with: python3 generate_report.py <json_data>
Outputs raw PDF bytes to stdout.
"""

import sys
import json
import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF

# ── Colour palette (HealthChain green) ───────────────────────────────────────
GREEN_DARK   = colors.HexColor("#052e16")
GREEN_MID    = colors.HexColor("#166534")
GREEN_LIGHT  = colors.HexColor("#dcfce7")
GREEN_ACCENT = colors.HexColor("#4ade80")
SLATE        = colors.HexColor("#374151")
GRAY         = colors.HexColor("#6b7280")
LIGHT_GRAY   = colors.HexColor("#f3f4f6")
BORDER       = colors.HexColor("#e5e7eb")
WHITE        = colors.white
RED          = colors.HexColor("#dc2626")
AMBER        = colors.HexColor("#d97706")
BLUE         = colors.HexColor("#2563eb")
PURPLE       = colors.HexColor("#7c3aed")

W, H = A4
MARGIN = 18 * mm

# ── Styles ────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def sty(name, **kw):
    return ParagraphStyle(name, **kw)

TITLE_STYLE   = sty("title",   fontName="Helvetica-Bold",   fontSize=22, textColor=WHITE,        leading=26)
SUBTITLE_STYLE= sty("sub",     fontName="Helvetica",        fontSize=10, textColor=colors.HexColor("#bbf7d0"), leading=13)
H1_STYLE      = sty("h1",      fontName="Helvetica-Bold",   fontSize=13, textColor=GREEN_DARK,   leading=18, spaceBefore=14, spaceAfter=6)
H2_STYLE      = sty("h2",      fontName="Helvetica-Bold",   fontSize=10, textColor=GREEN_MID,    leading=14, spaceBefore=8, spaceAfter=4)
BODY_STYLE    = sty("body",    fontName="Helvetica",        fontSize=9,  textColor=SLATE,        leading=13)
SMALL_STYLE   = sty("small",   fontName="Helvetica",        fontSize=8,  textColor=GRAY,         leading=11)
LABEL_STYLE   = sty("label",   fontName="Helvetica-Bold",   fontSize=8,  textColor=GRAY,         leading=11, spaceAfter=2)
META_STYLE    = sty("meta",    fontName="Helvetica",        fontSize=8,  textColor=colors.HexColor("#9ca3af"), leading=11)

# ── Helpers ───────────────────────────────────────────────────────────────────

def fmt_num(n):
    try: return f"{int(n):,}"
    except: return str(n)

def fmt_pct(n):
    try: return f"{int(n)}%"
    except: return "—"

def fmt_date(iso):
    try: return datetime.fromisoformat(iso.replace("Z","")).strftime("%d %b %Y")
    except: return iso or "—"

def stat_table(rows):
    """rows = [(label, value, color), ...]  — 2 or 4 columns"""
    data = []
    row = []
    for i, (label, value, col) in enumerate(rows):
        cell = [
            Paragraph(str(value), ParagraphStyle("sv", fontName="Helvetica-Bold", fontSize=18, textColor=col, leading=22)),
            Paragraph(label,      ParagraphStyle("sl", fontName="Helvetica",      fontSize=8,  textColor=GRAY, leading=11)),
        ]
        row.append(cell)
        if len(row) == 2 or i == len(rows)-1:
            while len(row) < 2: row.append([""])
            data.append(row)
            row = []

    col_w = (W - 2*MARGIN) / 2
    t = Table([[r[0], r[1]] for r in data] if data else [[""]], colWidths=[col_w]*2)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHT_GRAY),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [WHITE, LIGHT_GRAY]),
        ("BOX",        (0,0), (-1,-1), 0.5, BORDER),
        ("INNERGRID",  (0,0), (-1,-1), 0.5, BORDER),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",(0,0), (-1,-1), 12),
        ("RIGHTPADDING",(0,0),(-1,-1), 12),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",(0,0),(-1,-1), 10),
    ]))
    return t

def kv_table(pairs, col_widths=None):
    """Simple two-column key-value table"""
    cw = col_widths or [(W - 2*MARGIN)*0.38, (W - 2*MARGIN)*0.62]
    data = [[Paragraph(k, LABEL_STYLE), Paragraph(str(v), BODY_STYLE)] for k, v in pairs]
    t = Table(data, colWidths=cw)
    t.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [WHITE, LIGHT_GRAY]),
        ("BOX",        (0,0), (-1,-1), 0.5, BORDER),
        ("INNERGRID",  (0,0), (-1,-1), 0.5, BORDER),
        ("VALIGN",     (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING",(0,0), (-1,-1), 10),
        ("RIGHTPADDING",(0,0),(-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING",(0,0),(-1,-1), 7),
    ]))
    return t

def section_header(title):
    return [
        Spacer(1, 6),
        HRFlowable(width="100%", thickness=0.5, color=BORDER),
        Spacer(1, 4),
        Paragraph(title, H1_STYLE),
    ]

def mini_bar_chart(items, max_val, bar_color=GREEN_MID, width=None, height=120):
    """items = [(label, value), ...]"""
    if not items or max_val == 0:
        return Spacer(1, 4)
    w = width or (W - 2*MARGIN)
    d = Drawing(w, height)
    n = len(items)
    bar_w = min(40, (w - 20) / n - 6)
    gap = (w - n * bar_w) / (n + 1)
    for i, (label, val) in enumerate(items):
        x = gap + i * (bar_w + gap)
        bh = max(4, int((val / max_val) * (height - 30)))
        # Bar
        r = Rect(x, 22, bar_w, bh, fillColor=bar_color, strokeColor=None)
        d.add(r)
        # Value label
        d.add(String(x + bar_w/2, 22 + bh + 3, fmt_num(val),
                     fontName="Helvetica-Bold", fontSize=7, fillColor=SLATE,
                     textAnchor="middle"))
        # X label
        lbl = str(label)[:8]
        d.add(String(x + bar_w/2, 8, lbl,
                     fontName="Helvetica", fontSize=6.5, fillColor=GRAY,
                     textAnchor="middle"))
    return d

def progress_bar(label, value, total, color=GREEN_MID, width=None):
    w = width or (W - 2*MARGIN)
    pct = min(100, int(value / total * 100)) if total > 0 else 0
    d = Drawing(w, 26)
    # Background
    d.add(Rect(0, 8, w*0.7, 10, fillColor=LIGHT_GRAY, strokeColor=None, rx=5, ry=5))
    # Fill
    if pct > 0:
        d.add(Rect(0, 8, w*0.7*pct/100, 10, fillColor=color, strokeColor=None, rx=5, ry=5))
    # Labels
    d.add(String(0, 0, label, fontName="Helvetica", fontSize=8, fillColor=GRAY))
    d.add(String(w*0.7 + 6, 8, f"{fmt_num(value)} / {fmt_num(total)}  ({pct}%)",
                 fontName="Helvetica-Bold", fontSize=8, fillColor=SLATE))
    return d

# ── Header block ──────────────────────────────────────────────────────────────

def build_header(story, data):
    report_type = data.get("reportType", "report").title()
    inst_name   = data.get("institutionName", "All Institutions")
    period_from = fmt_date(data.get("period", {}).get("from", ""))
    period_to   = fmt_date(data.get("period", {}).get("to", ""))
    generated   = fmt_date(data.get("generatedAt", ""))
    is_super    = data.get("isSuperAdmin", False)

    # Green header banner
    header_h = 60
    d = Drawing(W - 2*MARGIN, header_h)
    d.add(Rect(0, 0, W - 2*MARGIN, header_h, fillColor=GREEN_DARK, strokeColor=None, rx=8, ry=8))
    # Accent strip
    d.add(Rect(0, header_h - 4, W - 2*MARGIN, 4, fillColor=GREEN_ACCENT, strokeColor=None, rx=2, ry=2))
    # Title
    d.add(String(16, header_h - 24, f"MedLink EMR — {report_type} Report",
                 fontName="Helvetica-Bold", fontSize=15, fillColor=colors.white))
    d.add(String(16, header_h - 38, inst_name,
                 fontName="Helvetica", fontSize=9, fillColor=colors.HexColor("#bbf7d0")))
    d.add(String(16, header_h - 50, f"Period: {period_from} — {period_to}   |   Generated: {generated}",
                 fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#86efac")))
    # Admin badge
    badge = "SUPER ADMIN" if is_super else "HOSPITAL ADMIN"
    badge_x = W - 2*MARGIN - 100
    d.add(Rect(badge_x, header_h//2 - 8, 90, 18, fillColor=colors.HexColor("#fef2f2") if is_super else colors.HexColor("#eff6ff"), strokeColor=None, rx=9, ry=9))
    d.add(String(badge_x + 45, header_h//2 - 3, badge,
                 fontName="Helvetica-Bold", fontSize=7,
                 fillColor=RED if is_super else BLUE, textAnchor="middle"))
    story.append(d)
    story.append(Spacer(1, 10))

# ── Clinical report ───────────────────────────────────────────────────────────

def build_clinical(story, data):
    v = data.get("visits", {})
    lab = data.get("laboratory", {})
    img = data.get("imaging", {})
    rx  = data.get("pharmacy", {})

    story += section_header("Visit Summary")
    story.append(stat_table([
        ("Total Visits",    fmt_num(v.get("total",0)),     GREEN_MID),
        ("Completed",       fmt_num(v.get("completed",0)), colors.HexColor("#0e7490")),
        ("Active",          fmt_num(v.get("active",0)),    BLUE),
        ("Cancelled",       fmt_num(v.get("cancelled",0)), RED),
    ]))
    story.append(Spacer(1, 10))

    # Visits by priority
    by_prio = v.get("byPriority", [])
    if by_prio:
        story.append(Paragraph("Visits by Priority", H2_STYLE))
        prio_colors = {"critical": RED, "urgent": AMBER, "emergency": colors.HexColor("#ea580c"), "routine": GREEN_MID}
        max_v = max((r.get("count",0) for r in by_prio), default=1)
        story.append(mini_bar_chart(
            [(r["priority"], r["count"]) for r in by_prio], max_v,
            bar_color=GREEN_MID, height=100
        ))
        story.append(Spacer(1, 6))

    # Visits by type
    by_type = v.get("byType", [])
    if by_type:
        story.append(Paragraph("Visits by Type", H2_STYLE))
        max_v = max((r.get("count",0) for r in by_type), default=1)
        story.append(mini_bar_chart(
            [(r["type"], r["count"]) for r in by_type], max_v,
            bar_color=BLUE, height=100
        ))
        story.append(Spacer(1, 6))

    story += section_header("Department Performance")

    # Lab
    story.append(Paragraph("Laboratory", H2_STYLE))
    story.append(progress_bar("Completed", lab.get("completed",0), lab.get("total",1), GREEN_MID))
    story.append(Spacer(1, 4))
    story.append(kv_table([
        ("Total Orders", fmt_num(lab.get("total",0))),
        ("Completed",    fmt_num(lab.get("completed",0))),
        ("Pending",      fmt_num(lab.get("pending",0))),
    ]))
    story.append(Spacer(1, 8))

    # Imaging
    story.append(Paragraph("Imaging / Radiology", H2_STYLE))
    story.append(progress_bar("Reported", img.get("completed",0), img.get("total",1), PURPLE))
    story.append(Spacer(1, 4))
    story.append(kv_table([
        ("Total Orders", fmt_num(img.get("total",0))),
        ("Reported",     fmt_num(img.get("completed",0))),
        ("Pending",      fmt_num(img.get("pending",0))),
    ]))
    story.append(Spacer(1, 8))

    # Pharmacy
    story.append(Paragraph("Pharmacy", H2_STYLE))
    story.append(progress_bar("Dispensed", rx.get("dispensed",0), rx.get("total",1), AMBER))
    story.append(Spacer(1, 4))
    story.append(kv_table([
        ("Total Prescriptions", fmt_num(rx.get("total",0))),
        ("Dispensed",           fmt_num(rx.get("dispensed",0))),
        ("Pending",             fmt_num(rx.get("pending",0))),
    ]))

# ── Operational report ────────────────────────────────────────────────────────

def build_operational(story, data):
    ref  = data.get("referrals", {})
    appt = data.get("appointments", {})
    docs = data.get("staffActivity", {}).get("topDoctors", [])

    story += section_header("Referrals")
    story.append(stat_table([
        ("Outgoing Referrals", fmt_num(ref.get("totalOutgoing",0)), GREEN_MID),
        ("Incoming Referrals", fmt_num(ref.get("totalIncoming",0)), BLUE),
        ("Acceptance Rate",    fmt_pct(ref.get("acceptanceRate",0)), colors.HexColor("#0e7490")),
        ("Rejected",           fmt_num(ref.get("rejected",0)),       RED),
    ]))
    story.append(Spacer(1, 8))
    story.append(kv_table([
        ("Pending",   fmt_num(ref.get("pending",0))),
        ("Accepted",  fmt_num(ref.get("accepted",0))),
        ("Completed", fmt_num(ref.get("completed",0))),
        ("Rejected",  fmt_num(ref.get("rejected",0))),
    ]))

    story += section_header("Appointments")
    story.append(stat_table([
        ("Total Appointments", fmt_num(appt.get("total",0)),        BLUE),
        ("Attendance Rate",    fmt_pct(appt.get("attendanceRate",0)), GREEN_MID),
    ]))
    story.append(Spacer(1, 8))
    story.append(progress_bar("Attended", appt.get("attended",0), appt.get("total",1), GREEN_MID))
    story.append(Spacer(1, 4))
    story.append(progress_bar("Cancelled", appt.get("cancelled",0), appt.get("total",1), RED))

    if docs:
        story += section_header("Top Doctors by Visit Count")
        tdata = [["#", "Doctor", "Specialization", "Visits"]]
        for i, doc in enumerate(docs[:15], 1):
            tdata.append([
                str(i),
                doc.get("name","—"),
                doc.get("specialization","—") or "—",
                fmt_num(doc.get("visitCount",0)),
            ])
        cw = [(W-2*MARGIN)*f for f in [0.06, 0.38, 0.38, 0.18]]
        t = Table(tdata, colWidths=cw)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),  GREEN_DARK),
            ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,0),  8),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
            ("FONTSIZE",      (0,1), (-1,-1), 8),
            ("TEXTCOLOR",     (0,1), (-1,-1), SLATE),
            ("ALIGN",         (3,0), (3,-1),  "CENTER"),
            ("FONTNAME",      (3,1), (3,-1),  "Helvetica-Bold"),
            ("TEXTCOLOR",     (3,1), (3,-1),  GREEN_MID),
            ("BOX",           (0,0), (-1,-1), 0.5, BORDER),
            ("INNERGRID",     (0,0), (-1,-1), 0.5, BORDER),
            ("TOPPADDING",    (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ]))
        story.append(t)

# ── Administrative report ─────────────────────────────────────────────────────

def build_administrative(story, data):
    pts   = data.get("patients", {})
    staff = data.get("staff", {})
    audit = data.get("audit", {})
    insts = data.get("institutions")

    story += section_header("Patient Statistics")
    story.append(stat_table([
        ("Total Patients",    fmt_num(pts.get("total",0)),       BLUE),
        ("New Registrations", fmt_num(pts.get("newInPeriod",0)), GREEN_MID),
    ]))

    story += section_header("Staff Statistics")
    story.append(stat_table([
        ("Total Staff",   fmt_num(staff.get("total",0)),      GREEN_MID),
        ("Unverified",    fmt_num(staff.get("unverified",0)),  RED),
    ]))
    story.append(Spacer(1, 8))

    by_role = staff.get("byRole", [])
    if by_role:
        story.append(Paragraph("Staff by Role", H2_STYLE))
        max_v = max((r.get("count",0) for r in by_role), default=1)
        story.append(mini_bar_chart(
            [(r["role"][:10], r["count"]) for r in by_role], max_v,
            bar_color=PURPLE, height=110
        ))

    story += section_header("Audit Events")
    story.append(stat_table([
        ("Total Events", fmt_num(audit.get("totalEvents",0)), SLATE),
        ("Action Types", fmt_num(len(audit.get("byAction",[]))), GREEN_MID),
    ]))
    story.append(Spacer(1, 8))

    by_action = audit.get("byAction", [])
    if by_action:
        tdata = [["Action Type", "Count"]]
        for a in by_action[:12]:
            tdata.append([
                a.get("action","—").replace("_"," ").title(),
                fmt_num(a.get("count",0)),
            ])
        cw = [(W-2*MARGIN)*0.7, (W-2*MARGIN)*0.3]
        t = Table(tdata, colWidths=cw)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),  GREEN_DARK),
            ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,0),  8),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
            ("FONTSIZE",      (0,1), (-1,-1), 8),
            ("TEXTCOLOR",     (0,1), (-1,-1), SLATE),
            ("ALIGN",         (1,0), (1,-1),  "CENTER"),
            ("FONTNAME",      (1,1), (1,-1),  "Helvetica-Bold"),
            ("TEXTCOLOR",     (1,1), (1,-1),  GREEN_MID),
            ("BOX",           (0,0), (-1,-1), 0.5, BORDER),
            ("INNERGRID",     (0,0), (-1,-1), 0.5, BORDER),
            ("TOPPADDING",    (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ]))
        story.append(t)

    # Institution comparison (super admin)
    if insts and insts.get("list"):
        story += section_header("Institution Comparison")
        tdata = [["Institution", "Type", "Patients", "Staff", "Visits", "Status"]]
        for inst in insts["list"]:
            tdata.append([
                inst.get("name","—"),
                inst.get("type","—").title(),
                fmt_num(inst.get("totalPatients",0)),
                fmt_num(inst.get("totalStaff",0)),
                fmt_num(inst.get("totalVisits",0)),
                "Active" if inst.get("isActive") else "Inactive",
            ])
        cw = [(W-2*MARGIN)*f for f in [0.32, 0.13, 0.13, 0.10, 0.13, 0.13, 0.06]]
        cw = cw[:6]  # 6 columns
        t = Table(tdata, colWidths=cw)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),  GREEN_DARK),
            ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,0),  7.5),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
            ("FONTSIZE",      (0,1), (-1,-1), 7.5),
            ("TEXTCOLOR",     (0,1), (-1,-1), SLATE),
            ("BOX",           (0,0), (-1,-1), 0.5, BORDER),
            ("INNERGRID",     (0,0), (-1,-1), 0.5, BORDER),
            ("TOPPADDING",    (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("LEFTPADDING",   (0,0), (-1,-1), 6),
            ("ALIGN",         (2,0), (-1,-1), "CENTER"),
        ]))
        story.append(t)

# ── Footer ────────────────────────────────────────────────────────────────────

def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRAY)
    canvas.drawString(MARGIN, 10*mm, "MedLink EMR — Copperbelt University — Confidential")
    canvas.drawRightString(W - MARGIN, 10*mm, f"Page {doc.page}")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 14*mm, W - MARGIN, 14*mm)
    canvas.restoreState()

# ── Main ──────────────────────────────────────────────────────────────────────

def generate(data: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=20*mm,
        title=f"MedLink {data.get('reportType','').title()} Report",
        author="MedLink EMR",
    )

    story = []
    build_header(story, data)

    rtype = data.get("reportType", "")
    if   rtype == "clinical":       build_clinical(story, data)
    elif rtype == "operational":    build_operational(story, data)
    elif rtype == "administrative": build_administrative(story, data)

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    return buf.getvalue()


if __name__ == "__main__":
    raw  = sys.argv[1] if len(sys.argv) > 1 else "{}"
    data = json.loads(raw)
    sys.stdout.buffer.write(generate(data))