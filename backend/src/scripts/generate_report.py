#!/usr/bin/env python3
"""
HealthChain EMR — Professional Report Generator
Called by the backend: python3 generate_report.py <json_data>
Outputs raw PDF bytes to stdout.
"""

import sys
import json
import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak,
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF

# ── Palette ───────────────────────────────────────────────────────────────────
GREEN_DARK   = colors.HexColor("#052e16")
GREEN_MID    = colors.HexColor("#166534")
GREEN_LIGHT  = colors.HexColor("#f0fdf4")
GREEN_ACCENT = colors.HexColor("#4ade80")
TEAL         = colors.HexColor("#0e7490")
BLUE         = colors.HexColor("#2563eb")
PURPLE       = colors.HexColor("#7c3aed")
AMBER        = colors.HexColor("#d97706")
RED          = colors.HexColor("#dc2626")
PINK         = colors.HexColor("#db2777")
SLATE        = colors.HexColor("#374151")
GRAY         = colors.HexColor("#6b7280")
LIGHT_GRAY   = colors.HexColor("#f8fafc")
BORDER       = colors.HexColor("#e5e7eb")
WHITE        = colors.white

W, H   = A4
MARGIN = 20 * mm
BODY_W = W - 2 * MARGIN

# ── Typography ────────────────────────────────────────────────────────────────
def sty(name, **kw):
    return ParagraphStyle(name, **kw)

COVER_TITLE  = sty("ct",  fontName="Helvetica-Bold",  fontSize=24, textColor=WHITE,      leading=30)
COVER_SUB    = sty("cs",  fontName="Helvetica",        fontSize=11, textColor=colors.HexColor("#bbf7d0"), leading=15)
COVER_META   = sty("cm",  fontName="Helvetica",        fontSize=9,  textColor=colors.HexColor("#86efac"), leading=13)
EXEC_BODY    = sty("eb",  fontName="Helvetica",        fontSize=10, textColor=SLATE,      leading=16)
H1           = sty("h1",  fontName="Helvetica-Bold",   fontSize=13, textColor=GREEN_DARK, leading=18, spaceBefore=16, spaceAfter=6)
H2           = sty("h2",  fontName="Helvetica-Bold",   fontSize=10, textColor=GREEN_MID,  leading=14, spaceBefore=10, spaceAfter=4)
BODY         = sty("bd",  fontName="Helvetica",        fontSize=9,  textColor=SLATE,      leading=14)
SMALL        = sty("sm",  fontName="Helvetica",        fontSize=8,  textColor=GRAY,       leading=12)
LABEL        = sty("lb",  fontName="Helvetica-Bold",   fontSize=8,  textColor=GRAY,       leading=11, spaceAfter=2)
TH           = sty("th",  fontName="Helvetica-Bold",   fontSize=8,  textColor=WHITE,      leading=11)
TD           = sty("td",  fontName="Helvetica",        fontSize=8,  textColor=SLATE,      leading=12)
TD_BOLD      = sty("tdb", fontName="Helvetica-Bold",   fontSize=8,  textColor=GREEN_MID,  leading=12)
MONO         = sty("mn",  fontName="Courier-Bold",     fontSize=8,  textColor=GREEN_MID,  leading=12)

# ── Formatters ────────────────────────────────────────────────────────────────
def fmt(n):
    try:    return f"{int(n):,}"
    except: return str(n) if n else "—"

def pct(n):
    try:    return f"{int(n)}%"
    except: return "—"

def fdate(iso):
    try:    return datetime.fromisoformat(str(iso).replace("Z", "")).strftime("%d %b %Y")
    except: return str(iso) if iso else "—"

def fdatetime(iso):
    try:    return datetime.fromisoformat(str(iso).replace("Z", "")).strftime("%d %b %Y  %H:%M")
    except: return str(iso) if iso else "—"

# ── Drawing helpers ───────────────────────────────────────────────────────────
def bar_chart(items, max_val, bar_color=GREEN_MID, height=110):
    """items = [(label, value), ...]"""
    if not items or max_val == 0:
        return Spacer(1, 4)
    d   = Drawing(BODY_W, height)
    n   = len(items)
    bw  = min(36, (BODY_W - 20) / n - 8)
    gap = (BODY_W - n * bw) / (n + 1)
    for i, (label, val) in enumerate(items):
        x  = gap + i * (bw + gap)
        bh = max(4, int((val / max_val) * (height - 30)))
        d.add(Rect(x, 22, bw, bh, fillColor=bar_color, strokeColor=None, rx=3, ry=3))
        d.add(String(x + bw / 2, 22 + bh + 3, fmt(val),
                     fontName="Helvetica-Bold", fontSize=7, fillColor=SLATE, textAnchor="middle"))
        lbl = str(label)[:9]
        d.add(String(x + bw / 2, 8, lbl,
                     fontName="Helvetica", fontSize=6.5, fillColor=GRAY, textAnchor="middle"))
    return d

def progress_bar(label, value, total, color=GREEN_MID):
    pw  = BODY_W
    pct_ = min(100, int(value / total * 100)) if total > 0 else 0
    d   = Drawing(pw, 28)
    bar_w = pw * 0.55
    d.add(Rect(0, 10, bar_w, 10, fillColor=LIGHT_GRAY, strokeColor=BORDER, strokeWidth=0.5, rx=5, ry=5))
    if pct_ > 0:
        d.add(Rect(0, 10, bar_w * pct_ / 100, 10, fillColor=color, strokeColor=None, rx=5, ry=5))
    d.add(String(0, 0, label, fontName="Helvetica-Bold", fontSize=8, fillColor=GRAY))
    d.add(String(bar_w + 8, 10, f"{fmt(value)} / {fmt(total)}   ({pct_}%)",
                 fontName="Helvetica-Bold", fontSize=8, fillColor=SLATE))
    return d

# ── Table builders ────────────────────────────────────────────────────────────

_TABLE_BASE = TableStyle([
    ("BACKGROUND",    (0, 0), (-1,  0), GREEN_DARK),
    ("TEXTCOLOR",     (0, 0), (-1,  0), WHITE),
    ("FONTNAME",      (0, 0), (-1,  0), "Helvetica-Bold"),
    ("FONTSIZE",      (0, 0), (-1,  0), 8),
    ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
    ("FONTSIZE",      (0, 1), (-1, -1), 8),
    ("TEXTCOLOR",     (0, 1), (-1, -1), SLATE),
    ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
    ("INNERGRID",     (0, 0), (-1, -1), 0.5, BORDER),
    ("TOPPADDING",    (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LEFTPADDING",   (0, 0), (-1, -1), 9),
    ("RIGHTPADDING",  (0, 0), (-1, -1), 9),
    ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
])

def make_table(data, col_fracs, extra_style=None):
    cw = [BODY_W * f for f in col_fracs]
    t  = Table(data, colWidths=cw, repeatRows=1)
    ts = TableStyle(_TABLE_BASE.getCommands())
    if extra_style:
        for cmd in extra_style:
            ts.add(*cmd)
    t.setStyle(ts)
    return t

def kv_table(pairs):
    data = [
        [Paragraph(k, LABEL), Paragraph(str(v), BODY)]
        for k, v in pairs
    ]
    return make_table(data, [0.38, 0.62])

def stat_grid(cells):
    """cells = [(label, value, color), ...]  — 2 per row"""
    rows = []
    for i in range(0, len(cells), 2):
        row = []
        for label, value, col in cells[i: i + 2]:
            row.append([
                Paragraph(str(value), ParagraphStyle("sv", fontName="Helvetica-Bold",
                          fontSize=20, textColor=col, leading=24)),
                Paragraph(label, SMALL),
            ])
        while len(row) < 2:
            row.append([Paragraph("", SMALL), Paragraph("", SMALL)])
        rows.append(row)

    data = [[r[0], r[1]] for r in rows]
    t = Table(data, colWidths=[BODY_W / 2, BODY_W / 2])
    t.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    return t

# ── Section header ────────────────────────────────────────────────────────────
_sec_counter = [0]

def section(title, reset=False):
    if reset:
        _sec_counter[0] = 0
    _sec_counter[0] += 1
    return KeepTogether([
        Spacer(1, 8),
        HRFlowable(width="100%", thickness=1, color=GREEN_MID, spaceAfter=4),
        Paragraph(f"{_sec_counter[0]}.  {title}", H1),
    ])

def subsection(title):
    return Paragraph(title, H2)

# ── Cover / header page ───────────────────────────────────────────────────────

def build_cover(story, data):
    report_type  = data.get("reportType", "report").title()
    inst_name    = data.get("institutionName", "All Institutions")
    period_from  = fdate(data.get("period", {}).get("from", ""))
    period_to    = fdate(data.get("period", {}).get("to",   ""))
    generated    = fdatetime(data.get("generatedAt", ""))
    is_super     = data.get("isSuperAdmin", False)
    scope_label  = "SUPER ADMIN — SYSTEM-WIDE" if is_super else "INSTITUTION REPORT"
    scope_color  = RED if is_super else BLUE
    scope_bg     = colors.HexColor("#fef2f2") if is_super else colors.HexColor("#eff6ff")

    # ── Banner ────────────────────────────────────────────────────────────────
    h = 80
    d = Drawing(BODY_W, h)
    # Base rect
    d.add(Rect(0, 0, BODY_W, h, fillColor=GREEN_DARK, strokeColor=None, rx=10, ry=10))
    # Accent strip top
    d.add(Rect(0, h - 5, BODY_W, 5, fillColor=GREEN_ACCENT, strokeColor=None, rx=2, ry=2))
    # Accent strip bottom
    d.add(Rect(0, 0, BODY_W, 3, fillColor=colors.HexColor("#14532d"), strokeColor=None))
    # Title
    d.add(String(18, h - 30, f"HealthChain EMR — {report_type} Report",
                 fontName="Helvetica-Bold", fontSize=17, fillColor=WHITE))
    d.add(String(18, h - 46, inst_name,
                 fontName="Helvetica", fontSize=10, fillColor=colors.HexColor("#bbf7d0")))
    d.add(String(18, h - 60, f"Reporting Period:  {period_from}  to  {period_to}",
                 fontName="Helvetica", fontSize=9, fillColor=colors.HexColor("#86efac")))
    d.add(String(18, h - 73, f"Generated:  {generated}",
                 fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#4ade80")))
    # Scope badge
    bx = BODY_W - 130
    d.add(Rect(bx, h // 2 - 11, 118, 22, fillColor=scope_bg, strokeColor=None, rx=11, ry=11))
    d.add(String(bx + 59, h // 2 - 5, scope_label,
                 fontName="Helvetica-Bold", fontSize=7, fillColor=scope_color, textAnchor="middle"))

    story.append(d)
    story.append(Spacer(1, 6))

    # ── Metadata strip ────────────────────────────────────────────────────────
    meta_data = [
        [Paragraph("Report Type", LABEL),     Paragraph(report_type,   BODY),
         Paragraph("Institution", LABEL),      Paragraph(inst_name,     BODY)],
        [Paragraph("Period From", LABEL),      Paragraph(period_from,   BODY),
         Paragraph("Period To",   LABEL),      Paragraph(period_to,     BODY)],
        [Paragraph("Access Level", LABEL),     Paragraph("Super Admin — All Institutions" if is_super else "Institution Admin", BODY),
         Paragraph("Classification", LABEL),   Paragraph("CONFIDENTIAL — Authorised Personnel Only", BODY)],
    ]
    mt = Table(meta_data, colWidths=[BODY_W * f for f in [0.17, 0.33, 0.17, 0.33]])
    mt.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(mt)
    story.append(Spacer(1, 10))

# ── Executive summary box ─────────────────────────────────────────────────────

def exec_summary(story, paragraphs):
    """paragraphs = list of plain-text strings"""
    story.append(section("Executive Summary", reset=True))
    # Left-border box
    content = []
    for p in paragraphs:
        content.append(Paragraph(p, EXEC_BODY))
        content.append(Spacer(1, 5))

    inner = Table([[content]], colWidths=[BODY_W - 12])
    inner.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 16),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_GRAY),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEAFTER",     (0, 0), (0, -1),  4,   GREEN_MID),
    ]))
    story.append(inner)
    story.append(Spacer(1, 6))

# ── Clinical ──────────────────────────────────────────────────────────────────

def build_clinical(story, data):
    v    = data.get("visits",      {})
    lab  = data.get("laboratory",  {})
    img  = data.get("imaging",     {})
    rx   = data.get("pharmacy",    {})
    diag = data.get("topDiagnoses", [])
    demo = data.get("patientsByGender", [])
    los  = data.get("avgLengthOfStay", 0)

    total = v.get("total", 0)
    rate  = v.get("completionRate", round(v.get("completed", 0) / total * 100) if total else 0)
    lab_r = round(lab.get("completed", 0) / lab.get("total", 1) * 100) if lab.get("total") else 0
    top   = diag[0] if diag else None

    # Executive summary
    lines = [
        f"{fmt(total)} patient visits recorded in the reporting period with a <b>{rate}%</b> completion rate. "
        f"{fmt(v.get('active', 0))} visits remain active; {fmt(v.get('cancelled', 0))} were cancelled.",
    ]
    if los:
        lines.append(
            f"Average length of stay for completed admissions: <b>{float(los):.1f} days</b>. "
            f"Laboratory throughput: {fmt(lab.get('completed', 0))} of {fmt(lab.get('total', 0))} orders completed ({lab_r}%)."
        )
    if top:
        lines.append(
            f"Most frequently recorded diagnosis: <b>\"{top['name']}\"</b>"
            + (f" (ICD: {top['icdCode']})" if top.get("icdCode") else "")
            + f" — {fmt(top['count'])} cases. "
            f"{fmt(rx.get('dispensed', 0))} of {fmt(rx.get('total', 0))} prescriptions dispensed."
        )
    exec_summary(story, lines)

    # ── 2. Visit Summary ─────────────────────────────────────────────────────
    story.append(section("Visit Summary"))
    story.append(stat_grid([
        ("Total Visits",    fmt(v.get("total", 0)),          GREEN_MID),
        ("Completion Rate", pct(rate),                        TEAL),
        ("Completed",       fmt(v.get("completed", 0)),       TEAL),
        ("Active",          fmt(v.get("active", 0)),          BLUE),
        ("Cancelled",       fmt(v.get("cancelled", 0)),       RED),
        ("Avg. Length of Stay", f"{float(los):.1f} d" if los else "—", SLATE),
    ]))
    story.append(Spacer(1, 10))

    by_prio = v.get("byPriority", [])
    if by_prio:
        story.append(subsection("Visits by Priority"))
        max_v = max((r.get("count", 0) for r in by_prio), default=1)
        story.append(bar_chart(
            [(r["priority"].title(), r["count"]) for r in by_prio], max_v, bar_color=GREEN_MID
        ))
        story.append(Spacer(1, 6))

    by_type = v.get("byType", [])
    if by_type:
        story.append(subsection("Visits by Type"))
        max_v = max((r.get("count", 0) for r in by_type), default=1)
        story.append(bar_chart(
            [(r["type"].title(), r["count"]) for r in by_type], max_v, bar_color=BLUE
        ))
        story.append(Spacer(1, 6))

    # ── 3. Department Performance ─────────────────────────────────────────────
    story.append(section("Department Performance"))

    story.append(subsection("Laboratory"))
    story.append(progress_bar("Completion", lab.get("completed", 0), max(lab.get("total", 1), 1), GREEN_MID))
    story.append(Spacer(1, 4))
    story.append(kv_table([
        ("Total Orders",     fmt(lab.get("total", 0))),
        ("Completed / Resulted", fmt(lab.get("completed", 0))),
        ("Pending",          fmt(lab.get("pending", 0))),
        ("Completion Rate",  pct(lab_r)),
    ]))
    story.append(Spacer(1, 10))

    img_r = round(img.get("completed", 0) / img.get("total", 1) * 100) if img.get("total") else 0
    story.append(subsection("Imaging / Radiology"))
    story.append(progress_bar("Reported", img.get("completed", 0), max(img.get("total", 1), 1), PURPLE))
    story.append(Spacer(1, 4))
    story.append(kv_table([
        ("Total Orders",    fmt(img.get("total", 0))),
        ("Reported",        fmt(img.get("completed", 0))),
        ("Pending",         fmt(img.get("pending", 0))),
        ("Reporting Rate",  pct(img_r)),
    ]))
    story.append(Spacer(1, 10))

    rx_r = round(rx.get("dispensed", 0) / rx.get("total", 1) * 100) if rx.get("total") else 0
    story.append(subsection("Pharmacy"))
    story.append(progress_bar("Dispensed", rx.get("dispensed", 0), max(rx.get("total", 1), 1), AMBER))
    story.append(Spacer(1, 4))
    story.append(kv_table([
        ("Total Prescriptions", fmt(rx.get("total", 0))),
        ("Dispensed",           fmt(rx.get("dispensed", 0))),
        ("Pending",             fmt(rx.get("pending", 0))),
        ("Dispensing Rate",     pct(rx_r)),
    ]))

    # ── 4. Top Diagnoses ──────────────────────────────────────────────────────
    if diag:
        story.append(section("Top Diagnoses"))
        story.append(Paragraph(
            "Most frequently recorded clinical diagnoses during the reporting period, ranked by case count.",
            BODY,
        ))
        story.append(Spacer(1, 6))

        tdata = [[
            Paragraph("#",          TH),
            Paragraph("ICD Code",   TH),
            Paragraph("Diagnosis",  TH),
            Paragraph("Cases",      TH),
            Paragraph("% of Visits",TH),
        ]]
        for i, dx in enumerate(diag, 1):
            dx_pct = f"{dx['count'] / total * 100:.1f}%" if total else "—"
            tdata.append([
                Paragraph(str(i), SMALL),
                Paragraph(dx.get("icdCode") or "—", MONO if dx.get("icdCode") else SMALL),
                Paragraph(dx.get("name", "—"), BODY),
                Paragraph(fmt(dx.get("count", 0)), TD_BOLD),
                Paragraph(dx_pct, BODY),
            ])
        t = make_table(tdata, [0.06, 0.13, 0.49, 0.15, 0.17], extra_style=[
            ("ALIGN",    (3, 0), (4, -1), "CENTER"),
            ("FONTNAME", (3, 1), (3, -1), "Helvetica-Bold"),
            ("TEXTCOLOR",(3, 1), (3, -1), GREEN_MID),
        ])
        story.append(t)

    # ── 5. Patient Demographics ───────────────────────────────────────────────
    if demo:
        story.append(section("Patient Demographics"))
        total_pts = sum(r.get("count", 0) for r in demo)
        demo_data = [
            [Paragraph("Gender", TH), Paragraph("Patient Count", TH), Paragraph("Proportion", TH)]
        ]
        for row in demo:
            g   = str(row.get("gender", "—")).title()
            cnt = row.get("count", 0)
            prop = f"{cnt / total_pts * 100:.1f}%" if total_pts else "—"
            demo_data.append([
                Paragraph(g,        BODY),
                Paragraph(fmt(cnt), TD_BOLD),
                Paragraph(prop,     BODY),
            ])
        story.append(make_table(demo_data, [0.40, 0.35, 0.25], extra_style=[
            ("ALIGN",    (1, 0), (2, -1), "CENTER"),
            ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
            ("TEXTCOLOR",(1, 1), (1, -1), BLUE),
        ]))
        story.append(kv_table([("Unique Patients in Period", fmt(total_pts))]))

# ── Operational ───────────────────────────────────────────────────────────────

def build_operational(story, data):
    ref   = data.get("referrals",     {})
    appt  = data.get("appointments",  {})
    staff = data.get("staffActivity", {})
    docs  = staff.get("topDoctors",   [])

    total_ref  = ref.get("totalOutgoing", 0)
    att_rate   = appt.get("attendanceRate", 0)
    avg_visits = staff.get("avgVisitsPerDoctor", 0)
    n_docs     = staff.get("totalActiveDoctors", 0)

    lines = [
        f"{fmt(total_ref)} outgoing referrals processed — acceptance rate <b>{pct(ref.get('acceptanceRate', 0))}</b>. "
        f"{fmt(ref.get('completed', 0))} completed; {fmt(ref.get('rejected', 0))} rejected.",
        f"Appointment compliance: <b>{pct(att_rate)}</b> attendance rate — "
        f"{fmt(appt.get('attended', 0))} attended, {fmt(appt.get('cancelled', 0))} cancelled "
        f"of {fmt(appt.get('total', 0))} scheduled.",
    ]
    if n_docs:
        lines.append(
            f"{fmt(n_docs)} active physician{'' if n_docs == 1 else 's'} recorded an average of "
            f"<b>{fmt(avg_visits)} visits</b> per physician during this period."
        )
    exec_summary(story, lines)

    # ── 2. Referrals ──────────────────────────────────────────────────────────
    story.append(section("Referral Activity"))
    story.append(stat_grid([
        ("Outgoing Referrals", fmt(ref.get("totalOutgoing", 0)), GREEN_MID),
        ("Incoming Referrals", fmt(ref.get("totalIncoming", 0)), BLUE),
        ("Acceptance Rate",    pct(ref.get("acceptanceRate", 0)), TEAL),
        ("Rejected",           fmt(ref.get("rejected", 0)),       RED),
    ]))
    story.append(Spacer(1, 10))
    story.append(kv_table([
        ("Pending",                        fmt(ref.get("pending", 0))),
        ("Accepted",                       fmt(ref.get("accepted", 0))),
        ("Completed",                      fmt(ref.get("completed", 0))),
        ("Rejected",                       fmt(ref.get("rejected", 0))),
        ("Outgoing — Acceptance Rate",     pct(ref.get("acceptanceRate", 0))),
    ]))
    story.append(Spacer(1, 6))
    story.append(progress_bar("Accepted + Completed", ref.get("accepted", 0) + ref.get("completed", 0), max(total_ref, 1), GREEN_MID))

    # ── 3. Appointments ───────────────────────────────────────────────────────
    story.append(section("Appointment Compliance"))
    story.append(stat_grid([
        ("Total Scheduled",  fmt(appt.get("total", 0)),    BLUE),
        ("Attendance Rate",  pct(att_rate),                 GREEN_MID),
        ("Attended",         fmt(appt.get("attended", 0)),  GREEN_MID),
        ("Cancelled",        fmt(appt.get("cancelled", 0)), RED),
    ]))
    story.append(Spacer(1, 10))
    story.append(progress_bar("Attended",  appt.get("attended",  0), max(appt.get("total", 1), 1), GREEN_MID))
    story.append(Spacer(1, 4))
    story.append(progress_bar("Cancelled", appt.get("cancelled", 0), max(appt.get("total", 1), 1), RED))

    # ── 4. Physician Performance ──────────────────────────────────────────────
    if docs:
        story.append(section("Physician Performance"))
        story.append(kv_table([
            ("Active Physicians",         fmt(n_docs)),
            ("Avg. Visits / Physician",   fmt(avg_visits)),
        ]))
        story.append(Spacer(1, 8))

        tdata = [[
            Paragraph("#",               TH),
            Paragraph("Physician",       TH),
            Paragraph("Specialization",  TH),
            Paragraph("Visit Count",     TH),
        ]]
        for i, doc in enumerate(docs[:15], 1):
            tdata.append([
                Paragraph(str(i), SMALL),
                Paragraph(f"Dr. {doc.get('name', '—')}", BODY),
                Paragraph(doc.get("specialization") or "General Practice", SMALL),
                Paragraph(fmt(doc.get("visitCount", 0)), TD_BOLD),
            ])
        story.append(make_table(tdata, [0.06, 0.40, 0.36, 0.18], extra_style=[
            ("ALIGN",    (3, 0), (3, -1), "CENTER"),
            ("FONTNAME", (3, 1), (3, -1), "Helvetica-Bold"),
            ("TEXTCOLOR",(3, 1), (3, -1), GREEN_MID),
        ]))

# ── Administrative ────────────────────────────────────────────────────────────

def build_administrative(story, data):
    pts   = data.get("patients",      {})
    staff = data.get("staff",         {})
    audit = data.get("audit",         {})
    insts = data.get("institutions")

    ver_rate = staff.get("verificationRate", 100)
    verified = staff.get("verified", staff.get("total", 0) - staff.get("unverified", 0))

    lines = [
        f"{fmt(pts.get('newInPeriod', 0))} new patients registered in the period, "
        f"bringing the total to <b>{fmt(pts.get('total', 0))}</b> active patients.",
        f"Workforce: {fmt(staff.get('total', 0))} active staff — {fmt(verified)} verified "
        f"(<b>{pct(ver_rate)}</b> credential compliance). "
        f"{fmt(staff.get('unverified', 0))} account{'s' if staff.get('unverified', 0) != 1 else ''} pending verification.",
    ]
    total_events = audit.get("totalEvents", 0)
    if total_events:
        lines.append(
            f"{fmt(total_events)} audit events logged across "
            f"{len(audit.get('byAction', []))} distinct action types — "
            f"full tamper-evident activity trail recorded on the blockchain ledger."
        )
    exec_summary(story, lines)

    # ── 2. Patient Statistics ─────────────────────────────────────────────────
    story.append(section("Patient Statistics"))
    story.append(stat_grid([
        ("Total Active Patients",   fmt(pts.get("total", 0)),         BLUE),
        ("New Registrations",       fmt(pts.get("newInPeriod", 0)),   GREEN_MID),
    ]))
    story.append(Spacer(1, 10))

    trend = pts.get("registrationTrend", [])
    if trend:
        story.append(subsection("Registration Trend"))
        max_v = max((r.get("count", 0) for r in trend), default=1)
        story.append(bar_chart(
            [(r["date"][5:] if len(str(r.get("date", ""))) >= 7 else str(r.get("date", "")), r["count"])
             for r in trend], max_v, bar_color=BLUE, height=100
        ))

    # ── 3. Workforce Statistics ───────────────────────────────────────────────
    story.append(section("Workforce Statistics"))
    story.append(stat_grid([
        ("Total Staff",              fmt(staff.get("total", 0)),    GREEN_MID),
        ("Credential Compliance",    pct(ver_rate),                  TEAL),
        ("Verified Accounts",        fmt(verified),                  TEAL),
        ("Pending Verification",     fmt(staff.get("unverified", 0)), RED),
    ]))
    story.append(Spacer(1, 8))
    story.append(progress_bar("Verified", verified, max(staff.get("total", 1), 1), GREEN_MID))
    story.append(Spacer(1, 8))

    by_role = staff.get("byRole", [])
    if by_role:
        story.append(subsection("Staff by Role"))
        max_v = max((r.get("count", 0) for r in by_role), default=1)
        story.append(bar_chart(
            [(r["role"][:11].replace("_", " ").title(), r["count"]) for r in by_role],
            max_v, bar_color=PURPLE, height=100,
        ))
        story.append(Spacer(1, 6))

        role_data = [[Paragraph("Role", TH), Paragraph("Headcount", TH), Paragraph("% of Total", TH)]]
        total_staff = staff.get("total", 0)
        for r in by_role:
            cnt  = r.get("count", 0)
            prop = f"{cnt / total_staff * 100:.1f}%" if total_staff else "—"
            role_data.append([
                Paragraph(str(r.get("role", "—")).replace("_", " ").title(), BODY),
                Paragraph(fmt(cnt), TD_BOLD),
                Paragraph(prop, BODY),
            ])
        story.append(make_table(role_data, [0.50, 0.25, 0.25], extra_style=[
            ("ALIGN",    (1, 0), (2, -1), "CENTER"),
            ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
            ("TEXTCOLOR",(1, 1), (1, -1), PURPLE),
        ]))

    # ── 4. Audit & Compliance ─────────────────────────────────────────────────
    story.append(section("Audit & Compliance"))
    story.append(stat_grid([
        ("Total Audit Events", fmt(total_events),                    SLATE),
        ("Distinct Actions",   fmt(len(audit.get("byAction", []))), GREEN_MID),
    ]))
    story.append(Spacer(1, 8))

    by_action = audit.get("byAction", [])
    if by_action:
        adata = [[Paragraph("Action Type", TH), Paragraph("Event Count", TH), Paragraph("% Share", TH)]]
        for a in by_action[:15]:
            cnt  = a.get("count", 0)
            prop = f"{cnt / total_events * 100:.1f}%" if total_events else "—"
            adata.append([
                Paragraph(str(a.get("action", "—")).replace("_", " ").title(), BODY),
                Paragraph(fmt(cnt), TD_BOLD),
                Paragraph(prop, BODY),
            ])
        story.append(make_table(adata, [0.55, 0.25, 0.20], extra_style=[
            ("ALIGN",    (1, 0), (2, -1), "CENTER"),
            ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
            ("TEXTCOLOR",(1, 1), (1, -1), GREEN_MID),
        ]))

    # ── 5. Institution Comparison (super admin) ───────────────────────────────
    if insts and insts.get("list"):
        story.append(section("Institution Comparison"))
        story.append(kv_table([
            ("Total Institutions", fmt(insts.get("total", 0))),
            ("Active",             fmt(insts.get("active", 0))),
        ]))
        story.append(Spacer(1, 8))

        idata = [[
            Paragraph("Institution",   TH),
            Paragraph("Type",          TH),
            Paragraph("Patients",      TH),
            Paragraph("Staff",         TH),
            Paragraph("Total Visits",  TH),
            Paragraph("Status",        TH),
        ]]
        for inst in insts["list"]:
            status = "Active" if inst.get("isActive") else "Inactive"
            idata.append([
                Paragraph(inst.get("name", "—"),                                  BODY),
                Paragraph(str(inst.get("type", "—")).title(),                     SMALL),
                Paragraph(fmt(inst.get("totalPatients", 0)),                      TD_BOLD),
                Paragraph(fmt(inst.get("totalStaff", 0)),                         BODY),
                Paragraph(fmt(inst.get("totalVisits", 0)),                        TD_BOLD),
                Paragraph(status,                                                  BODY),
            ])
        story.append(make_table(idata, [0.30, 0.12, 0.13, 0.12, 0.18, 0.15], extra_style=[
            ("ALIGN",    (2, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (2, 1), (2, -1), "Helvetica-Bold"),
            ("TEXTCOLOR",(2, 1), (2, -1), BLUE),
            ("FONTNAME", (4, 1), (4, -1), "Helvetica-Bold"),
            ("TEXTCOLOR",(4, 1), (4, -1), GREEN_MID),
        ]))

# ── Personal Performance Report ──────────────────────────────────────────────

ROLE_LABELS = {
    "practitioner":   "Physician",
    "nurse":          "Nurse",
    "lab_technician": "Lab Technician",
    "radiologist":    "Radiologist",
    "pharmacist":     "Pharmacist",
    "receptionist":   "Receptionist",
}

ROLE_COLORS = {
    "practitioner":   BLUE,
    "nurse":          TEAL,
    "lab_technician": AMBER,
    "radiologist":    PURPLE,
    "pharmacist":     GREEN_MID,
    "receptionist":   SLATE,
}

def build_personal_cover(story, data):
    staff_name  = data.get("staffName", "Staff Member")
    role        = data.get("role", "")
    spec        = data.get("specialization", "")
    role_label  = ROLE_LABELS.get(role, "Staff")
    role_color  = ROLE_COLORS.get(role, SLATE)
    period_from = fdate(data.get("period", {}).get("from", ""))
    period_to   = fdate(data.get("period", {}).get("to",   ""))
    generated   = fdatetime(data.get("generatedAt", ""))

    h = 80
    d = Drawing(BODY_W, h)
    d.add(Rect(0, 0, BODY_W, h, fillColor=GREEN_DARK, strokeColor=None, rx=10, ry=10))
    d.add(Rect(0, h - 5, BODY_W, 5, fillColor=GREEN_ACCENT, strokeColor=None, rx=2, ry=2))
    d.add(Rect(0, 0, BODY_W, 3, fillColor=colors.HexColor("#14532d"), strokeColor=None))
    d.add(String(18, h - 30, "HealthChain EMR — Personal Performance Report",
                 fontName="Helvetica-Bold", fontSize=17, fillColor=WHITE))
    name_str = f"Dr. {staff_name}" if role == "practitioner" else staff_name
    d.add(String(18, h - 46, name_str,
                 fontName="Helvetica", fontSize=10, fillColor=colors.HexColor("#bbf7d0")))
    d.add(String(18, h - 60, f"Reporting Period:  {period_from}  to  {period_to}",
                 fontName="Helvetica", fontSize=9, fillColor=colors.HexColor("#86efac")))
    d.add(String(18, h - 73, f"Generated:  {generated}",
                 fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#4ade80")))
    # Role badge
    bx = BODY_W - 120
    d.add(Rect(bx, h // 2 - 11, 108, 22, fillColor=colors.HexColor("#e0f2fe"), strokeColor=None, rx=11, ry=11))
    d.add(String(bx + 54, h // 2 - 5, role_label.upper(),
                 fontName="Helvetica-Bold", fontSize=7, fillColor=BLUE, textAnchor="middle"))

    story.append(d)
    story.append(Spacer(1, 6))

    meta_data = [
        [Paragraph("Staff Member", LABEL), Paragraph(name_str, BODY),
         Paragraph("Role", LABEL),         Paragraph(role_label, BODY)],
        [Paragraph("Specialization", LABEL), Paragraph(spec or "—", BODY),
         Paragraph("Period", LABEL),          Paragraph(f"{period_from} → {period_to}", BODY)],
        [Paragraph("Report Type", LABEL), Paragraph("Individual Performance Report", BODY),
         Paragraph("Classification", LABEL), Paragraph("CONFIDENTIAL — Authorised Personnel Only", BODY)],
    ]
    mt = Table(meta_data, colWidths=[BODY_W * f for f in [0.17, 0.33, 0.17, 0.33]])
    mt.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(mt)
    story.append(Spacer(1, 10))


def _personal_exec_summary(story, data):
    role   = data.get("role", "")
    name   = data.get("staffName", "")
    s      = data.get("summary", {})

    if role == "practitioner":
        lines = [
            f"<b>Dr. {name}</b> conducted <b>{fmt(s.get('consultations', 0))}</b> consultation(s) and recorded "
            f"<b>{fmt(s.get('diagnosesMade', 0))}</b> diagnoses during the reporting period.",
            f"Orders placed: <b>{fmt(s.get('labOrdersPlaced', 0))}</b> laboratory, "
            f"<b>{fmt(s.get('imagingOrdered', 0))}</b> imaging, "
            f"<b>{fmt(s.get('prescriptionsWritten', 0))}</b> prescriptions — "
            f"<b>{pct(s.get('dispensingRate', 0))}</b> dispensing rate.",
        ]
    elif role == "nurse":
        lines = [
            f"<b>{name}</b> recorded <b>{fmt(s.get('vitalsRecorded', 0))}</b> set(s) of vital signs "
            f"for <b>{fmt(s.get('distinctPatients', 0))}</b> unique patient(s) during the period.",
            f"A total of <b>{fmt(s.get('assignedVisits', 0))}</b> visit(s) were assigned to this nurse.",
        ]
    elif role == "lab_technician":
        lines = [
            f"<b>{name}</b> resulted <b>{fmt(s.get('testsResulted', 0))}</b> laboratory test(s) during the reporting period.",
            (f"<b>{fmt(s.get('pendingAssigned', 0))}</b> test order(s) are currently assigned and awaiting processing."
             if s.get("pendingAssigned", 0) > 0 else "No tests currently pending assignment."),
        ]
    elif role == "radiologist":
        lines = [
            f"<b>{name}</b> completed <b>{fmt(s.get('reportsCompleted', 0))}</b> imaging report(s) during this period.",
            (f"<b>{fmt(s.get('pendingAssigned', 0))}</b> imaging study(s) are currently assigned and pending reporting."
             if s.get("pendingAssigned", 0) > 0 else "No imaging studies currently pending."),
        ]
    elif role == "pharmacist":
        lines = [
            f"<b>{name}</b> dispensed <b>{fmt(s.get('itemsDispensed', 0))}</b> medication item(s) across "
            f"<b>{fmt(s.get('prescriptionsDispensed', 0))}</b> prescription(s) during this period.",
            f"<b>{fmt(s.get('stockMovementsDone', 0))}</b> stock movement record(s) (receipts, adjustments, dispensing) logged.",
        ]
    elif role == "receptionist":
        lines = [
            f"<b>{name}</b> opened <b>{fmt(s.get('visitsCreated', 0))}</b> patient visit(s) — "
            f"<b>{fmt(s.get('appointmentsCreated', 0))}</b> scheduled appointment(s) and "
            f"<b>{fmt(s.get('walkinVisits', 0))}</b> walk-in(s) — during the reporting period.",
        ]
    else:
        lines = ["No performance data available for this role."]

    story.append(section("Performance Summary", reset=True))
    inner = Table([[[ Paragraph(l, EXEC_BODY) for l in lines ]]], colWidths=[BODY_W - 12])
    inner.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 16),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_GRAY),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEAFTER",     (0, 0), (0, -1),  4,   GREEN_MID),
    ]))
    story.append(inner)
    story.append(Spacer(1, 6))


def _trend_mini_table(story, trend, label="Activity"):
    """Render a compact date→count table (max 14 rows) when no chart is possible in ReportLab."""
    if not trend:
        return
    story.append(subsection(f"{label} — Daily Trend"))
    rows = [[ Paragraph("Date", TH), Paragraph("Count", TH) ]]
    for row in trend[:30]:
        rows.append([
            Paragraph(fdate(row.get("date", "")), BODY),
            Paragraph(fmt(row.get("count", 0)), TD_BOLD),
        ])
    story.append(make_table(rows, [0.65, 0.35], extra_style=[
        ("ALIGN",    (1, 0), (1, -1), "CENTER"),
        ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR",(1, 1), (1, -1), GREEN_MID),
    ]))
    story.append(Spacer(1, 6))


def build_personal(story, data):
    role = data.get("role", "")
    s    = data.get("summary", {})

    _personal_exec_summary(story, data)

    if role == "practitioner":
        # ── 2. Clinical Activity ──────────────────────────────────────────────
        story.append(section("Clinical Activity"))
        story.append(stat_grid([
            ("Consultations",       fmt(s.get("consultations", 0)),        BLUE),
            ("Diagnoses Made",      fmt(s.get("diagnosesMade", 0)),         GREEN_MID),
            ("Lab Orders",          fmt(s.get("labOrdersPlaced", 0)),       AMBER),
            ("Imaging Orders",      fmt(s.get("imagingOrdered", 0)),        PURPLE),
            ("Rx Written",          fmt(s.get("prescriptionsWritten", 0)),  TEAL),
            ("Rx Dispensing Rate",  pct(s.get("dispensingRate", 0)),        RED),
        ]))
        story.append(Spacer(1, 8))
        story.append(kv_table([
            ("Prescriptions Written",    fmt(s.get("prescriptionsWritten",  0))),
            ("Prescriptions Dispensed",  fmt(s.get("prescriptionsDispensed", 0))),
            ("Dispensing Rate",          pct(s.get("dispensingRate", 0))),
        ]))

        # ── 3. Activity Trend ─────────────────────────────────────────────────
        story.append(section("Activity Trend"))
        _trend_mini_table(story, data.get("trend", []), "Consultations")

        # ── 4. Top Diagnoses ──────────────────────────────────────────────────
        diag = data.get("topDiagnoses", [])
        if diag:
            story.append(section("Top Diagnoses"))
            tdata = [[
                Paragraph("#",           TH),
                Paragraph("ICD Code",    TH),
                Paragraph("Diagnosis",   TH),
                Paragraph("Count",       TH),
            ]]
            for i, dx in enumerate(diag, 1):
                tdata.append([
                    Paragraph(str(i), SMALL),
                    Paragraph(dx.get("icdCode") or "—", MONO if dx.get("icdCode") else SMALL),
                    Paragraph(dx.get("name", "—"), BODY),
                    Paragraph(fmt(dx.get("count", 0)), TD_BOLD),
                ])
            story.append(make_table(tdata, [0.06, 0.15, 0.57, 0.22], extra_style=[
                ("ALIGN",    (3, 0), (3, -1), "CENTER"),
                ("FONTNAME", (3, 1), (3, -1), "Helvetica-Bold"),
                ("TEXTCOLOR",(3, 1), (3, -1), GREEN_MID),
            ]))

        # ── 5. Order Breakdown ────────────────────────────────────────────────
        lab_cats = data.get("labByCategory", [])
        img_mods = data.get("imagingByModality", [])
        if lab_cats or img_mods:
            story.append(section("Order Breakdown"))
            if lab_cats:
                story.append(subsection("Lab Orders by Category"))
                ldata = [[Paragraph("Category", TH), Paragraph("Orders", TH)]]
                for r in lab_cats:
                    ldata.append([Paragraph(r.get("category", "—"), BODY), Paragraph(fmt(r.get("count", 0)), TD_BOLD)])
                story.append(make_table(ldata, [0.70, 0.30], extra_style=[
                    ("ALIGN",    (1, 0), (1, -1), "CENTER"),
                    ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
                    ("TEXTCOLOR",(1, 1), (1, -1), AMBER),
                ]))
                story.append(Spacer(1, 8))
            if img_mods:
                story.append(subsection("Imaging by Modality"))
                idata = [[Paragraph("Modality", TH), Paragraph("Studies", TH)]]
                for r in img_mods:
                    idata.append([Paragraph(r.get("modality", "—"), BODY), Paragraph(fmt(r.get("count", 0)), TD_BOLD)])
                story.append(make_table(idata, [0.70, 0.30], extra_style=[
                    ("ALIGN",    (1, 0), (1, -1), "CENTER"),
                    ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
                    ("TEXTCOLOR",(1, 1), (1, -1), PURPLE),
                ]))

        # ── 6. Recent Activity ────────────────────────────────────────────────
        recent = data.get("recentActivity", [])
        if recent:
            story.append(section("Recent Consultations"))
            rdata = [[
                Paragraph("Visit No.",       TH),
                Paragraph("Chief Complaint", TH),
                Paragraph("Priority",        TH),
                Paragraph("Date",            TH),
            ]]
            for r in recent:
                rdata.append([
                    Paragraph(r.get("visitNumber", "—"), MONO),
                    Paragraph(r.get("chiefComplaint") or "—", BODY),
                    Paragraph(str(r.get("priority", "—")).title(), BODY),
                    Paragraph(fdatetime(r.get("date", "")), SMALL),
                ])
            story.append(make_table(rdata, [0.18, 0.38, 0.14, 0.30]))

    elif role == "nurse":
        story.append(section("Nursing Activity"))
        story.append(stat_grid([
            ("Vitals Recorded",    fmt(s.get("vitalsRecorded",   0)), TEAL),
            ("Unique Patients",    fmt(s.get("distinctPatients",  0)), BLUE),
            ("Visits Assigned",    fmt(s.get("assignedVisits",    0)), GREEN_MID),
        ]))
        story.append(Spacer(1, 8))
        story.append(section("Daily Trend"))
        _trend_mini_table(story, data.get("trend", []), "Vital Signs Recorded")

    elif role == "lab_technician":
        story.append(section("Laboratory Activity"))
        story.append(stat_grid([
            ("Tests Resulted",     fmt(s.get("testsResulted",   0)), AMBER),
            ("Pending (Assigned)", fmt(s.get("pendingAssigned", 0)), RED),
        ]))
        story.append(Spacer(1, 8))

        cats = data.get("testByCategory", [])
        if cats:
            story.append(subsection("Tests by Category"))
            cdata = [[Paragraph("Category", TH), Paragraph("Count", TH)]]
            for r in cats:
                cdata.append([Paragraph(r.get("category", "—"), BODY), Paragraph(fmt(r.get("count", 0)), TD_BOLD)])
            story.append(make_table(cdata, [0.70, 0.30], extra_style=[
                ("ALIGN",    (1, 0), (1, -1), "CENTER"),
                ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
                ("TEXTCOLOR",(1, 1), (1, -1), AMBER),
            ]))
            story.append(Spacer(1, 8))

        story.append(section("Daily Trend"))
        _trend_mini_table(story, data.get("trend", []), "Tests Resulted")

    elif role == "radiologist":
        story.append(section("Radiology Activity"))
        story.append(stat_grid([
            ("Reports Completed",  fmt(s.get("reportsCompleted", 0)), PURPLE),
            ("Pending (Assigned)", fmt(s.get("pendingAssigned",  0)), RED),
        ]))
        story.append(Spacer(1, 8))

        mods = data.get("byModality", [])
        if mods:
            story.append(subsection("Studies by Modality"))
            mdata = [[Paragraph("Modality", TH), Paragraph("Count", TH)]]
            for r in mods:
                mdata.append([Paragraph(r.get("modality", "—"), BODY), Paragraph(fmt(r.get("count", 0)), TD_BOLD)])
            story.append(make_table(mdata, [0.70, 0.30], extra_style=[
                ("ALIGN",    (1, 0), (1, -1), "CENTER"),
                ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
                ("TEXTCOLOR",(1, 1), (1, -1), PURPLE),
            ]))
            story.append(Spacer(1, 8))

        story.append(section("Daily Trend"))
        _trend_mini_table(story, data.get("trend", []), "Reports Completed")

    elif role == "pharmacist":
        story.append(section("Pharmacy Activity"))
        story.append(stat_grid([
            ("Items Dispensed",          fmt(s.get("itemsDispensed",        0)), GREEN_MID),
            ("Prescriptions Dispensed",  fmt(s.get("prescriptionsDispensed", 0)), TEAL),
            ("Stock Movements",          fmt(s.get("stockMovementsDone",     0)), AMBER),
        ]))
        story.append(Spacer(1, 8))
        story.append(section("Daily Trend"))
        _trend_mini_table(story, data.get("trend", []), "Items Dispensed")

    elif role == "receptionist":
        story.append(section("Reception Activity"))
        story.append(stat_grid([
            ("Visits Opened",   fmt(s.get("visitsCreated",       0)), SLATE),
            ("Appointments",    fmt(s.get("appointmentsCreated",  0)), BLUE),
            ("Walk-ins",        fmt(s.get("walkinVisits",         0)), TEAL),
        ]))
        story.append(Spacer(1, 8))
        story.append(section("Daily Trend"))
        _trend_mini_table(story, data.get("trend", []), "Visits Opened")

    else:
        story.append(Paragraph("No role-specific data available.", BODY))


# ── Footer (every page) ───────────────────────────────────────────────────────

def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRAY)
    canvas.drawString(MARGIN, 10 * mm, "HealthChain EMR  ·  Copperbelt University  ·  CONFIDENTIAL — Authorised Personnel Only")
    canvas.drawRightString(W - MARGIN, 10 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 14 * mm, W - MARGIN, 14 * mm)
    canvas.restoreState()

# ── Entry point ───────────────────────────────────────────────────────────────

def generate(data: dict) -> bytes:
    buf   = io.BytesIO()
    rtype = data.get("reportType", "")

    if rtype == "personal":
        doc_subject = f"{data.get('staffName', 'Staff')} — Personal Performance Report"
    else:
        doc_subject = f"{data.get('institutionName', 'All Institutions')} — {rtype.title()} Report"

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=22 * mm,
        title=f"HealthChain — {rtype.title()} Report",
        author="HealthChain EMR",
        subject=doc_subject,
        creator="HealthChain EMR · Copperbelt University",
    )

    story: list = []

    if rtype == "personal":
        build_personal_cover(story, data)
    else:
        build_cover(story, data)

    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4))

    if   rtype == "clinical":       build_clinical(story, data)
    elif rtype == "operational":    build_operational(story, data)
    elif rtype == "administrative": build_administrative(story, data)
    elif rtype == "personal":       build_personal(story, data)

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    return buf.getvalue()


if __name__ == "__main__":
    raw  = sys.argv[1] if len(sys.argv) > 1 else "{}"
    data = json.loads(raw)
    sys.stdout.buffer.write(generate(data))
