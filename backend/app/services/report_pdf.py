"""CSR / personal impact report as a PDF (ReportLab, no external services)."""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.data.categories import CATEGORY_BY_SLUG
from app.services.impact import CAR_KG_CO2E_PER_KM, KG_PER_MEAL, TREE_KG_CO2_PER_YEAR

PLUM = colors.HexColor("#3D2C5A")
SOFT = colors.HexColor("#6E5D8C")
CORAL = colors.HexColor("#E8603C")
CREAM = colors.HexColor("#FFF7EC")
LINE = colors.HexColor("#EFE6D8")


def _fmt(n: float, unit: str = "") -> str:
    if unit == "kg" and n >= 1000:
        return f"{n / 1000:,.1f} t"
    return f"{n:,.0f}{(' ' + unit) if unit else ''}"


def build(org_name: str, role: str, verified: bool, period_label: str, given: dict, generated: datetime,
          demo_data: bool) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"REBIRTH impact report – {org_name}", author="REBIRTH")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], textColor=PLUM, fontSize=22, alignment=TA_LEFT, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=PLUM, fontSize=13, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=ss["BodyText"], textColor=PLUM, fontSize=10, leading=14)
    small = ParagraphStyle("small", parent=body, textColor=SOFT, fontSize=8.5, leading=11)

    t = given["total"]
    story = [
        Paragraph('<font color="#E8603C">RE</font>BIRTH · Impact report', h1),
        Paragraph(f"<b>{org_name}</b>{' · verified organisation' if verified else ''} · {period_label}", body),
        Paragraph(f"Generated {generated:%d %b %Y}", small),
        Spacer(1, 6 * mm),
    ]

    tiles = [
        ["CO2e avoided", "Goods given a second life", "Handovers", "Meals (food only)"],
        [_fmt(t["co2e_kg"], "kg"), _fmt(t["kg"], "kg"), f"{t['handovers']:,}", f"{t['meals']:,}"],
    ]
    tt = Table(tiles, colWidths=[43 * mm] * 4)
    tt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM), ("TEXTCOLOR", (0, 0), (-1, 0), SOFT), ("TEXTCOLOR", (0, 1), (-1, 1), PLUM),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5), ("FONTSIZE", (0, 1), (-1, 1), 16), ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("LINEAFTER", (0, 0), (-2, -1), 2, colors.white),
    ]))
    story += [tt, Spacer(1, 3 * mm), Paragraph(
        f"Equivalent to about <b>{t['car_km_avoided']:,} km</b> not driven by car, or what <b>{t['tree_years']:,.0f} trees</b> absorb in a year. "
        f"Water embodied in the goods: about <b>{t['water_l'] / 1000:,.0f} kL</b>.", body)]

    if given["by_category"]:
        story.append(Paragraph("By category", h2))
        rows = [["Category", "Handovers", "Kg reused", "CO2e avoided"]] + [
            [c["name"], f"{c['handovers']:,}", _fmt(c["kg"], "kg"), _fmt(c["co2e_kg"], "kg")] for c in given["by_category"]
        ]
        ct = Table(rows, colWidths=[70 * mm, 30 * mm, 35 * mm, 37 * mm])
        ct.setStyle(_table_style())
        story.append(ct)

    months = [m for m in given["by_month"] if m["handovers"]]
    if months:
        story.append(Paragraph("By month", h2))
        rows = [["Month", "Handovers", "Kg reused", "CO2e avoided"]] + [
            [datetime.strptime(m["month"], "%Y-%m").strftime("%b %Y"), f"{m['handovers']:,}", _fmt(m["kg"], "kg"), _fmt(m["co2e_kg"], "kg")]
            for m in months
        ]
        mt = Table(rows, colWidths=[70 * mm, 30 * mm, 35 * mm, 37 * mm])
        mt.setStyle(_table_style())
        story.append(mt)

    factors = ", ".join(f"{c.name.split(' ')[0].lower()} {c.co2e_per_kg:g}" for c in CATEGORY_BY_SLUG.values() if c.slug != "other")
    story += [
        Paragraph("Method", h2),
        Paragraph(
            "Each figure counts handovers recorded as completed on REBIRTH (the item reached a school, NGO, person, buyer or "
            "recycler). Kilograms = quantity × the category's kg per unit. CO2e avoided = kg × an indicative per-category "
            f"factor in kg CO2e per kg ({factors}). Meals = food kg ÷ {KG_PER_MEAL}. Car-km = CO2e ÷ {CAR_KG_CO2E_PER_KM} kg/km; "
            f"tree-years = CO2e ÷ {TREE_KG_CO2_PER_YEAR} kg/year.", body),
        Spacer(1, 2 * mm),
        Paragraph(
            "These factors are indicative averages for awareness and internal tracking. They are not an audited lifecycle "
            "assessment and should be replaced with sourced LCA data before use in statutory CSR filings."
            + (" <b>This report was generated from demo data that includes simulated activity.</b>" if demo_data else ""),
            small),
    ]
    doc.build(story)
    return buf.getvalue()


def _table_style() -> TableStyle:
    return TableStyle([
        ("TEXTCOLOR", (0, 0), (-1, -1), PLUM), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("LINEBELOW", (0, 0), (-1, 0), 1, PLUM), ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])
