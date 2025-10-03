"""
PDF Report Generator using ReportLab
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
from io import BytesIO

def generate_coordination_summary(data):
    """Generate action-oriented coordination summary"""
    
    # Build developer conflict map
    dev_conflicts = {}
    
    for conflict in data['conflicts']:
        if conflict['severity'] in ['BLOCKER', 'CRITICAL', 'HIGH']:  # Only critical ones
            for story in conflict['involved_stories']:
                dev = story['developer'] or 'Unknown'
                if dev not in dev_conflicts:
                    dev_conflicts[dev] = {
                        'stories': set(),
                        'must_coordinate_with': set(),
                        'critical_components': []
                    }
                
                dev_conflicts[dev]['stories'].add(story['id'])
                dev_conflicts[dev]['critical_components'].append({
                    'component': conflict['component']['api_name'],
                    'severity': conflict['severity'],
                    'action': conflict.get('recommendation', {}).get('action', 'Review required')
                })
                
                # Find who else is involved
                for other_story in conflict['involved_stories']:
                    other_dev = other_story['developer'] or 'Unknown'
                    if other_dev != dev:
                        dev_conflicts[dev]['must_coordinate_with'].add(other_dev)
    
    # Build action items per developer
    action_items = []
    
    for dev, info in sorted(dev_conflicts.items()):
        if len(info['critical_components']) == 0:
            continue
            
        stories_list = ', '.join(sorted(list(info['stories']))[:3])
        coord_with = ', '.join(sorted(list(info['must_coordinate_with']))[:3])
        
        # Get top action
        top_component = info['critical_components'][0]
        
        action_items.append({
            'developer': dev,
            'stories': stories_list,
            'coordinate_with': coord_with,
            'priority_action': top_component['action'],
            'risk_count': len(info['critical_components'])
        })
    
    # Sort by risk count
    action_items.sort(key=lambda x: x['risk_count'], reverse=True)
    
    return action_items[:10]

def generate_pdf_report(data, group_by_developer=False):
    """Generate PDF from analysis data"""
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, 
                          rightMargin=72, leftMargin=72,
                          topMargin=72, bottomMargin=18)
    
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#667eea'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#333333'),
        spaceAfter=12,
        spaceBefore=12
    )
    
    # Title
    story.append(Paragraph("Copado Deployment Conflict Analysis Report", title_style))
    story.append(Spacer(1, 0.2*inch))
    
    # Summary
    summary = data['summary']
    summary_data = [
        ['Generated:', datetime.now().strftime('%B %d, %Y at %I:%M %p')],
        ['Total Records:', str(summary['total_records'])],
        ['User Stories:', str(summary['unique_stories'])],
        ['Components:', str(summary['unique_components'])],
        ['Conflicts Found:', str(summary['total_conflicts'])],
        ['Avg Risk Score:', f"{summary['avg_risk_score']}/100"]
    ]
    
    summary_table = Table(summary_data, colWidths=[2*inch, 4*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    story.append(summary_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Severity breakdown
    story.append(Paragraph("Severity Breakdown", heading_style))
    severity_data = [
        ['BLOCKER:', str(summary['severity_breakdown']['blocker'])],
        ['CRITICAL:', str(summary['severity_breakdown']['critical'])],
        ['HIGH:', str(summary['severity_breakdown']['high'])],
        ['MEDIUM:', str(summary['severity_breakdown']['medium'])],
        ['LOW:', str(summary['severity_breakdown']['low'])]
    ]
    
    severity_table = Table(severity_data, colWidths=[2*inch, 1*inch])
    severity_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    
    story.append(severity_table)
    story.append(Spacer(1, 0.4*inch))
    
    if group_by_developer:
        story.extend(generate_developer_grouped_content(data, styles, heading_style))
    else:
        story.extend(generate_conflict_content(data, styles, heading_style))
    
    doc.build(story)
    buffer.seek(0)
    return buffer


def generate_conflict_content(data, styles, heading_style):
    """Generate conflict-based content"""
    content = []
    
    # ACTION-ORIENTED COORDINATION
    content.append(Paragraph("Critical Actions Required", heading_style))
    content.append(Spacer(1, 0.2*inch))
    
    action_items = generate_coordination_summary(data)
    
    if action_items:
        for item in action_items:
            # Developer box
            dev_text = f"<b>{item['developer']}</b> ({item['risk_count']} critical conflicts)"
            content.append(Paragraph(dev_text, styles['Heading4']))
            
            # Action item
            action_text = f"<b>Priority Action:</b> {item['priority_action']}"
            content.append(Paragraph(action_text, styles['Normal']))
            
            # Coordination needed
            coord_text = f"<b>Coordinate with:</b> {item['coordinate_with']}"
            content.append(Paragraph(coord_text, styles['Normal']))
            
            # Stories
            stories_text = f"<b>Your stories:</b> {item['stories']}"
            content.append(Paragraph(stories_text, styles['Normal']))
            
            content.append(Spacer(1, 0.15*inch))
    else:
        content.append(Paragraph("No critical coordination issues.", styles['Normal']))
    
    content.append(Spacer(1, 0.3*inch))
    
    # SUMMARY TABLE - Simple overview
    content.append(Paragraph("Quick Reference", heading_style))
    
    summary_data = [['Developer', 'Critical Items', 'Must Talk To']]
    
    for item in action_items[:6]:
        summary_data.append([
            item['developer'][:20],  # Truncate long names
            str(item['risk_count']),
            item['coordinate_with'][:30]
        ])
    
    if len(summary_data) > 1:
        summary_table = Table(summary_data, colWidths=[2*inch, 1*inch, 2.5*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc3545')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        content.append(summary_table)
    
    content.append(PageBreak())
    
    # DETAILED CONFLICTS
    content.append(Paragraph("Detailed Conflict Analysis", heading_style))
    content.append(Spacer(1, 0.2*inch))
    
    for conflict in data['conflicts'][:15]:  # Top 15
        # Conflict header
        severity_colors = {
            'BLOCKER': colors.HexColor('#dc3545'),
            'CRITICAL': colors.HexColor('#fd7e14'),
            'HIGH': colors.HexColor('#ffc107'),
            'MEDIUM': colors.HexColor('#0dcaf0'),
            'LOW': colors.HexColor('#198754')
        }
        
        severity_color = severity_colors.get(conflict['severity'], colors.grey)
        
        component_text = f"<b>{conflict['component']['api_name']}</b>"
        severity_text = f"<font color='{severity_color.hexval()}'><b>{conflict['severity']} - {conflict['risk_score']}/100</b></font>"
        
        content.append(Paragraph(component_text, styles['Heading3']))
        content.append(Paragraph(severity_text, styles['Normal']))
        content.append(Spacer(1, 0.1*inch))
        
        # Component details
        details = f"Type: {conflict['component']['type']} | Status: {conflict['component']['status']}"
        content.append(Paragraph(details, styles['Normal']))
        content.append(Spacer(1, 0.1*inch))
        
        # Stories
        stories_text = f"<b>Stories Involved ({len(conflict['involved_stories'])}):</b>"
        content.append(Paragraph(stories_text, styles['Normal']))
        
        for idx, story in enumerate(conflict['involved_stories'][:5]):  # Max 5
            is_latest = idx == 0
            latest_label = "[LATEST] " if is_latest else ""
            
            commit_date = story.get('commit_date', 'Unknown')
            if commit_date != 'Unknown':
                try:
                    commit_date = datetime.fromisoformat(commit_date.replace('Z', '+00:00')).strftime('%m/%d/%Y')
                except:
                    pass
            
            story_text = f"• {latest_label}<b>{story['id']}</b>: {story['title'][:60]}..."
            content.append(Paragraph(story_text, styles['Normal']))
            
            detail_text = f"  Dev: {story['developer'] or 'Unknown'} | Modified by: {story.get('created_by', 'Unknown')} | {commit_date}"
            content.append(Paragraph(detail_text, styles['Normal']))
        
        # Recommendation
        if 'recommendation' in conflict:
            rec = conflict['recommendation']
            content.append(Spacer(1, 0.1*inch))
            rec_text = f"<b>Action:</b> {rec['action']} | <b>Priority:</b> {rec['priority']}"
            content.append(Paragraph(rec_text, styles['Normal']))
            
            steps_text = "<b>Steps:</b><br/>" + "<br/>".join([f"{i+1}. {step}" for i, step in enumerate(rec['steps'][:3])])
            content.append(Paragraph(steps_text, styles['Normal']))
        
        content.append(Spacer(1, 0.25*inch))
    
    return content

def generate_developer_grouped_content(data, styles, heading_style):
    """Generate developer-grouped content"""
    content = []
    
    # Group by developer
    dev_data = {}
    for conflict in data['conflicts']:
        for story in conflict['involved_stories']:
            dev = story['developer'] or 'Unknown'
            if dev not in dev_data:
                dev_data[dev] = {'stories': set(), 'conflicts': []}
            dev_data[dev]['stories'].add(story['id'])
            dev_data[dev]['conflicts'].append(conflict)
    
    content.append(Paragraph("Analysis by Developer", heading_style))
    content.append(Spacer(1, 0.2*inch))
    
    for dev, info in sorted(dev_data.items()):
        content.append(Paragraph(f"<b>{dev}</b>", styles['Heading3']))
        content.append(Paragraph(f"Stories: {', '.join(sorted(list(info['stories'])[:10]))}", styles['Normal']))
        content.append(Paragraph(f"Conflicts: {len(info['conflicts'])}", styles['Normal']))
        content.append(Spacer(1, 0.2*inch))
    
    return content