"""
Copado Deployment Validator - Demo Presentation Generator
"""

from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime

def create_presentation():
    """Generate PDF presentation"""
    
    doc = SimpleDocTemplate(
        "Copado_Deployment_Validator_Demo.pdf",
        pagesize=landscape(letter),
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.5*inch,
        bottomMarain=0.5*inch
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=36,
        textColor=colors.HexColor('#667eea'),
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=20,
        textColor=colors.HexColor('#555555'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'SlideHeading',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=colors.HexColor('#333333'),
        spaceAfter=20,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'SlideBody',
        parent=styles['Normal'],
        fontSize=14,
        leading=22,
        textColor=colors.HexColor('#333333')
    )
    
    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontSize=16,
        leading=26,
        leftIndent=20,
        textColor=colors.HexColor('#333333')
    )
    
    # Slide 1: Title
    story.append(Spacer(1, 1.5*inch))
    story.append(Paragraph("🚀 Copado Deployment Validator", title_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("Prevent Production Failures Before They Happen", subtitle_style))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph(f"Demo Presentation - {datetime.now().strftime('%B %Y')}", body_style))
    story.append(PageBreak())
    
    # Slide 2: The Problem
    story.append(Paragraph("❌ The Problem", heading_style))
    story.append(Spacer(1, 0.3*inch))
    
    problems = [
        "Multiple developers modify the same Salesforce components",
        "No visibility into conflicts until deployment fails",
        "Manual analysis takes 2-3 hours per release",
        "Production failures cause emergency rollbacks",
        "Wasted developer time resolving conflicts post-deployment"
    ]
    
    for problem in problems:
        story.append(Paragraph(f"• {problem}", bullet_style))
    
    story.append(Spacer(1, 0.5*inch))
    
    cost_table = Table([
        ['💰 Cost Impact', ''],
        ['Time wasted per month:', '15+ hours in failed deployments'],
        ['Production downtime:', 'Revenue loss + reputation damage'],
        ['Developer frustration:', 'Context switching, weekend fixes']
    ], colWidths=[3*inch, 5*inch])
    
    cost_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc3545')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 16),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fff5f5')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dc3545')),
        ('PADDING', (0, 0), (-1, -1), 12)
    ]))
    
    story.append(cost_table)
    story.append(PageBreak())
    
    # Slide 3: The Solution
    story.append(Paragraph("✅ The Solution", heading_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("Automated Conflict Detection & Risk Analysis in 2 Seconds", subtitle_style))
    story.append(Spacer(1, 0.3*inch))
    
    solution_table = Table([
        ['1️⃣', 'Analyze all user stories and components'],
        ['2️⃣', 'Detect conflicts and production regressions'],
        ['3️⃣', 'Calculate risk scores (0-100 scale)'],
        ['4️⃣', 'Provide actionable recommendations per developer'],
        ['5️⃣', 'Generate safe deployment sequences']
    ], colWidths=[0.8*inch, 7*inch])
    
    solution_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 16),
        ('PADDING', (0, 0), (-1, -1), 15),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e8f5e9'))
    ]))
    
    story.append(solution_table)
    story.append(Spacer(1, 0.5*inch))
    
    result_box = Table([
        ['✨ Result: Zero-Surprise Deployments']
    ], colWidths=[8*inch])
    
    result_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 20),
        ('PADDING', (0, 0), (-1, -1), 20),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER')
    ]))
    
    story.append(result_box)
    story.append(PageBreak())
    
    # Slide 4: How It Works
    story.append(Paragraph("🔄 How It Works", heading_style))
    story.append(Spacer(1, 0.3*inch))
    
    flow_data = [
        ['Step', 'Action', 'Output'],
        ['1. Upload CSV', 'Export from Copado\n(Deployment + Production)', '2 files uploaded'],
        ['2. Analyze', 'AI-powered conflict detection\nRegression check\nRisk scoring', 'Analysis complete in 2 sec'],
        ['3. Review', 'Choose your view:\n• Developer: "Can I deploy?"\n• DevOps: "What\'s the plan?"', 'Actionable insights'],
        ['4. Export', 'Generate PDF reports', 'Share with stakeholders']
    ]
    
    flow_table = Table(flow_data, colWidths=[1.2*inch, 4*inch, 2.5*inch])
    
    flow_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 12),
        ('VALIGN', (0, 0), (-1, -1), 'TOP')
    ]))
    
    story.append(flow_table)
    story.append(PageBreak())
    
    # Slide 5: Regression Detection
    story.append(Paragraph("🔍 Key Feature: Regression Detection", heading_style))
    story.append(Spacer(1, 0.3*inch))
    
    story.append(Paragraph("<b>Problem:</b> Deploying old code overwrites production changes", body_style))
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("<b>Solution:</b> Automatically compare commit dates", body_style))
    story.append(Spacer(1, 0.5*inch))
    
    regression_example = Table([
        ['Component: ApexClass.PaymentProcessor'],
        [''],
        ['Production commit date: September 15, 2024'],
        ['Your commit date: September 12, 2024'],
        [''],
        ['❌ BLOCKED: Your code is 3 days older than production'],
        [''],
        ['Required Action: Update your branch from production baseline']
    ], colWidths=[8*inch])
    
    regression_example.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#333333')),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 16),
        ('BACKGROUND', (0, 2), (0, 3), colors.HexColor('#e3f2fd')),
        ('BACKGROUND', (0, 5), (0, 5), colors.HexColor('#ffebee')),
        ('TEXTCOLOR', (0, 5), (0, 5), colors.HexColor('#c62828')),
        ('FONTNAME', (0, 5), (0, 5), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 7), (0, 7), colors.HexColor('#fff3cd')),
        ('PADDING', (0, 0), (-1, -1), 15),
        ('FONTSIZE', (0, 0), (-1, -1), 14)
    ]))
    
    story.append(regression_example)
    story.append(PageBreak())
    
    # Slide 6: Risk Scoring
    story.append(Paragraph("⚠️ Intelligent Risk Scoring", heading_style))
    story.append(Spacer(1, 0.3*inch))
    
    story.append(Paragraph("5 factors analyzed per conflict:", body_style))
    story.append(Spacer(1, 0.3*inch))
    
    factors_table = Table([
        ['Factor', 'Impact', 'Weight'],
        ['Number of developers', 'Coordination overhead increases', '20 points'],
        ['Component type', 'ApexClass/Flow = critical', '25 points'],
        ['Copado conflict status', 'Flagged by Copado', '30 points'],
        ['Commit age', 'Old commits = higher risk', '15 points'],
        ['Story count', 'More stories = more complexity', '20 points']
    ], colWidths=[2.5*inch, 3.5*inch, 1.5*inch])
    
    factors_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')])
    ]))
    
    story.append(factors_table)
    story.append(Spacer(1, 0.4*inch))
    
    risk_scale = Table([
        ['0-20', 'Safe', '✅'],
        ['21-40', 'Review needed', '📋'],
        ['41-60', 'High risk', '⚠️'],
        ['61-80', 'Critical', '🔴'],
        ['81-100', 'Blocker', '❌']
    ], colWidths=[1.5*inch, 2*inch, 1*inch])
    
    risk_scale.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#198754')),
        ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#0dcaf0')),
        ('BACKGROUND', (0, 2), (0, 2), colors.HexColor('#ffc107')),
        ('BACKGROUND', (0, 3), (0, 3), colors.HexColor('#fd7e14')),
        ('BACKGROUND', (0, 4), (0, 4), colors.HexColor('#dc3545')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 16),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('PADDING', (0, 0), (-1, -1), 12)
    ]))
    
    story.append(risk_scale)
    story.append(PageBreak())
    
    # Slide 7: Developer View
    story.append(Paragraph("👨‍💻 Developer View", heading_style))
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph('"Can I Deploy My Stories?"', subtitle_style))
    story.append(Spacer(1, 0.3*inch))
    
    dev_view_example = Table([
        ['Your Stories: John Smith'],
        [''],
        ['❌ US-0001: BLOCKED'],
        ['Reason: Component older than production'],
        ['What to do:'],
        ['1. Pull latest code from production branch'],
        ['2. Rebase your changes on top of production'],
        ['3. Create new commit'],
        ['4. Update Copado with new commit ID'],
        [''],
        ['✅ US-0005: SAFE TO DEPLOY'],
        ['No blocking issues detected'],
        ['Action: Follow standard deployment process']
    ], colWidths=[8*inch])
    
    dev_view_example.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 18),
        ('BACKGROUND', (0, 2), (0, 8), colors.HexColor('#ffebee')),
        ('BACKGROUND', (0, 10), (0, 12), colors.HexColor('#e8f5e9')),
        ('PADDING', (0, 0), (-1, -1), 12),
        ('FONTSIZE', (0, 0), (-1, -1), 13),
        ('LEFTPADDING', (0, 5), (0, 8), 30)
    ]))
    
    story.append(dev_view_example)
    story.append(PageBreak())
    
    # Slide 8: DevOps View
    story.append(Paragraph("⚙️ DevOps View", heading_style))
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("Complete Deployment Planning & Control", subtitle_style))
    story.append(Spacer(1, 0.3*inch))
    
    devops_tabs = Table([
        ['Tab', 'Purpose', 'Key Information'],
        ['Overview', 'Executive summary', '• Total stories\n• Regressions detected\n• Blocked count\n• Next actions'],
        ['All Stories', 'Detailed story list', '• Filterable by status\n• Component details\n• Commit comparisons'],
        ['Deployment Plan', 'Execution strategy', '• Deployment batches\n• Safe sequence\n• Coordination needs'],
        ['Enforcement', 'Policy compliance', '• Regression violations\n• High-risk conflicts\n• Required actions']
    ], colWidths=[1.8*inch, 2.2*inch, 4*inch])
    
    devops_tabs.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#333333')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 12),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')])
    ]))
    
    story.append(devops_tabs)
    story.append(PageBreak())
    
    # Slide 9: Before & After
    story.append(Paragraph("⏱️ Before & After", heading_style))
    story.append(Spacer(1, 0.3*inch))
    
    comparison = Table([
        ['BEFORE (Manual Process)', 'AFTER (Automated)'],
        ['Export CSV from Copado: 5 min', 'Upload CSV: 30 sec'],
        ['Open Excel, analyze: 60 min', 'Auto-analysis: 2 sec'],
        ['Email developers: 30 min', 'Instant results in UI'],
        ['Wait for responses: 120 min', 'No waiting needed'],
        ['Create deployment plan: 45 min', 'Auto-generated plan: instant'],
        ['', ''],
        ['Total: 4+ hours', 'Total: 6 minutes'],
        ['', ''],
        ['Time Saved: 3 hours 54 minutes per deployment', '']
    ], colWidths=[4*inch, 4*inch])
    
    comparison.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#333333')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 16),
        ('BACKGROUND', (0, 1), (0, 5), colors.HexColor('#ffebee')),
        ('BACKGROUND', (1, 1), (1, 5), colors.HexColor('#e8f5e9')),
        ('BACKGROUND', (0, 7), (-1, 7), colors.HexColor('#fff3cd')),
        ('FONTNAME', (0, 7), (-1, 7), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 9), (-1, 9), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 9), (-1, 9), colors.white),
        ('FONTNAME', (0, 9), (-1, 9), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 9), (-1, 9), 18),
        ('SPAN', (0, 9), (1, 9)),
        ('ALIGN', (0, 9), (-1, 9), 'CENTER'),
        ('GRID', (0, 0), (-1, 8), 1, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 15)
    ]))
    
    story.append(comparison)
    story.append(PageBreak())
    
    # Slide 10: ROI
    story.append(Paragraph("💰 Return on Investment", heading_style))
    story.append(Spacer(1, 0.3*inch))
    
    roi_data = [
        ['Metric', 'Before', 'After', 'Impact'],
        ['Time per deployment', '4 hours', '6 minutes', '98% reduction'],
        ['Monthly deployments', '16', '16', '60+ hours saved/month'],
        ['Production failures', '3-5/month', '<1/month', '80% reduction'],
        ['Emergency fixes', '8+ hours', '~0 hours', 'Eliminated'],
        ['Developer satisfaction', 'Low', 'High', 'Better morale']
    ]
    
    roi_table = Table(roi_data, colWidths=[2.5*inch, 1.8*inch, 1.8*inch, 2*inch])
    
    roi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#198754')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 12),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')])
    ]))
    
    story.append(roi_table)
    story.append(Spacer(1, 0.5*inch))
    
    value_box = Table([
        ['✨ Value: 1.5 FTE reclaimed + Zero production regressions']
    ], colWidths=[8*inch])
    
    value_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 20),
        ('PADDING', (0, 0), (-1, -1), 20),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER')
    ]))
    
    story.append(value_box)
    story.append(PageBreak())
    
    # Slide 11: Roadmap
    story.append(Paragraph("🗺️ Product Roadmap", heading_style))
    story.append(Spacer(1, 0.3*inch))
    
    roadmap_data = [
        ['Phase', 'Timeline', 'Features', 'Status'],
        ['Phase 1:\nCSV Analysis', 'Complete', '• Conflict detection\n• Regression checking\n• Risk scoring\n• Dual views\n• PDF reports', '✅ DONE'],
        ['Phase 2:\nAutomation', 'Q1 2025', '• BitBucket API integration\n• Automated PR validation\n• Historical tracking\n• Trend analysis', '⏳ Planned'],
        ['Phase 3:\nIntegration', 'Q2 2025', '• Slack/Jira integration\n• Code diff analysis\n• Predictive analytics\n• Custom workflows', '🔮 Future']
    ]
    
    roadmap_table = Table(roadmap_data, colWidths=[1.5*inch, 1.3*inch, 4*inch, 1.2*inch])
    
    roadmap_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 12),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (3, 1), (3, 1), colors.HexColor('#d1f2eb')),
        ('BACKGROUND', (3, 2), (3, 2), colors.HexColor('#fff3cd')),
        ('BACKGROUND', (3, 3), (3, 3), colors.HexColor('#e3f2fd'))
    ]))
    
    story.append(roadmap_table)
    story.append(PageBreak())
    
    # Slide 12: Next Steps
    story.append(Paragraph("🎯 Next Steps", heading_style))
    story.append(Spacer(1, 0.3*inch))
    
    next_steps = Table([
        ['Week 1-2: Pilot Program'],
        ['• Use on next 5 deployments'],
        ['• Track prediction accuracy'],
        ['• Gather developer feedback'],
        ['• Measure time savings'],
        [''],
        ['Week 3: Team Training'],
        ['• Developer training session (1 hour)'],
        ['• DevOps training session (1 hour)'],
        ['• Best practices documentation'],
        [''],
        ['Week 4: Full Rollout'],
        ['• Mandatory for SIT/UAT/PROD deployments'],
        ['• Integrate with existing processes'],
        ['• Track success metrics'],
        ['• Continuous improvement']
    ], colWidths=[8*inch])
    
    next_steps.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#667eea')),
        ('BACKGROUND', (0, 6), (0, 6), colors.HexColor('#667eea')),
        ('BACKGROUND', (0, 11), (0, 11), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('TEXTCOLOR', (0, 6), (0, 6), colors.white),
        ('TEXTCOLOR', (0, 11), (0, 11), colors.white),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 6), (0, 6), 'Helvetica-Bold'),
        ('FONTNAME', (0, 11), (0, 11), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (0, 1), (0, 4), 30),
        ('LEFTPADDING', (0, 7), (0, 9), 30),
        ('LEFTPADDING', (0, 12), (0, 15), 30),
        ('PADDING', (0, 0), (-1, -1), 10)
    ]))
    
    story.append(next_steps)
    story.append(PageBreak())
    
    # Slide 13: Thank You
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("Thank You!", title_style))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("🚀 Copado Deployment Validator", subtitle_style))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("Questions?", body_style))
    story.append(Spacer(1, 0.3*inch))
    
    contact_table = Table([
        ['Ready for Live Demo →']
    ], colWidths=[6*inch])
    
    contact_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 24),
        ('PADDING', (0, 0), (-1, -1), 20),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER')
    ]))
    
    story.append(contact_table)
    
    # Build PDF
    doc.build(story)
    print("✅ Presentation created: Copado_Deployment_Validator_Demo.pdf")

if __name__ == "__main__":
    create_presentation()