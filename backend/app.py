"""
Flask REST API for Copado Deployment Validator

Endpoints:
  POST /api/analyze - Upload CSV and get conflict analysis
  GET  /api/health  - Health check
"""
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tempfile
from csv_parser import CopadoCSVParser
from conflict_detector import ConflictDetector
from models import ConflictSeverity
from pdf_generator import generate_pdf_report
from flask import send_file
from production_analyzer import parse_production_state, check_regression
from git_client import BitBucketClient 


# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Allow frontend to call this API

# Configuration
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'csv'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

from pdf_generator import generate_pdf_report
from flask import send_file

@app.route('/api/component-diff-details', methods=['POST'])
def get_component_diff_details():
    """
    Get detailed diff showing which files changed in a component
    """
    try:
        data = request.json
        component_name = data.get('component_name', '')
        component_type = data.get('component_type', '')
        branch1 = data.get('branch1', 'master')
        branch2 = data.get('branch2', 'uatsfdc')
        
        if '.' in component_name:
            component_name = component_name.split('.', 1)[1]
        
        git_client = BitBucketClient()
        
        diff_details = git_client.get_component_diff_details(
            component_name,
            component_type,
            branch1,
            branch2
        )
        
        return jsonify({
            'success': True,
            'diff_details': diff_details
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/get-code-diff', methods=['POST'])
def get_code_diff():
    try:
        data = request.json
        component_name = data.get('component_name', '')
        component_type = data.get('component_type', '')
        prod_branch = data.get('prod_branch', 'master')
        uat_branch = data.get('uat_branch', 'uatsfdc')
        
        if '.' in component_name:
            component_name = component_name.split('.', 1)[1]
        
        git_client = BitBucketClient()
        
        # Use bundle diff for multi-file components
        diff_result = git_client.get_bundle_diff(
            component_name=component_name,
            component_type=component_type,
            prod_branch=prod_branch,
            uat_branch=uat_branch
        )
        
        return jsonify({
            'success': True,
            'data': diff_result
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/export-pdf', methods=['POST'])
def export_pdf():
    """Generate and download PDF report"""
    try:
        # Get analysis data from request
        data = request.get_json()
        group_by_dev = data.get('group_by_developer', False)
        
        # Generate PDF
        pdf_file = generate_pdf_report(data, group_by_developer=group_by_dev)
        
        # Return PDF file
        filename = f"copado_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            pdf_file,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    
    Returns:
        JSON with status
    """
    return jsonify({
        'status': 'healthy',
        'service': 'Copado Deployment Validator API',
        'version': '1.0.0'
    })

@app.route('/api/production-state', methods=['POST'])
def get_production_state():
    """
    Get current state of components in production
    Shows what's currently in master branch
    """
    try:
        data = request.json
        components = data.get('components', [])
        
        if not components:
            return jsonify({
                'success': False,
                'error': 'No components provided'
            }), 400
        
        git_client = BitBucketClient()
        production_state = []
        
        for component in components:
            component_name = component.get('name', '')
            component_type = component.get('type', '')
            
            # Remove type prefix if present
            if '.' in component_name:
                component_name = component_name.split('.', 1)[1]
            
            # Build path
            #file_path = git_client.build_component_path(component_name, component_type)
            
            # Check if file exists in production
            #content = git_client.get_file_content(file_path, branch='master')
            # Try to find file using smart search
            content, actual_path = git_client.get_file_content_smart(
                component_name, 
                component_type, 
                branch='master'
            )

            file_path = actual_path or git_client.build_component_path(component_name, component_type)
            
            # Get latest commit for this file
            commits = git_client.get_file_commits(file_path, branch='master', limit=1)
            latest_commit = commits[0] if commits else None
            
            production_state.append({
                'component_name': component_name,
                'component_type': component_type,
                'file_path': file_path,
                'exists_in_prod': content is not None,
                'last_commit_hash': latest_commit['short_hash'] if latest_commit else None,
                'last_commit_date': latest_commit['date'] if latest_commit else None,
                'last_author': latest_commit['author'] if latest_commit else None,
                'last_commit_message': latest_commit['message'] if latest_commit else None,
                'file_size': len(content) if content else 0
            })
        
        return jsonify({
            'success': True,
            'production_state': production_state,
            'checked_at': datetime.now().isoformat(),
            'branch': 'master',
            'total_components': len(production_state),
            'existing': len([c for c in production_state if c['exists_in_prod']]),
            'missing': len([c for c in production_state if not c['exists_in_prod']])
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/compare-deployment', methods=['POST'])
def compare_deployment():
    """
    Compare deployment components with production
    
    Returns which components are:
    - Modified (exist in both, different content)
    - New (only in deployment)
    - Same (exist in both, identical content)
    """
    try:
        data = request.json
        components = data.get('components', [])
        
        if not components:
            return jsonify({
                'success': False,
                'error': 'No components provided'
            }), 400
        
        git_client = BitBucketClient()
        comparison_results = []
        
        for component in components:
            component_name = component.get('name', '')
            component_type = component.get('type', '')
            
            # Remove type prefix if present
            if '.' in component_name:
                component_name = component_name.split('.', 1)[1]
            
            # Get production version (master branch)
            prod_content, prod_path = git_client.get_file_content_smart(
                component_name, 
                component_type, 
                branch='master'
            )
            
            # Get UAT version (uat branch or master - depending on your setup)
            # For now, we'll assume UAT = master since we don't have separate UAT branch
            # You can change this to 'uat' if you have a UAT branch
            uat_content, uat_path = git_client.get_file_content_smart(
                component_name, 
                component_type, 
                branch='uatsfdc'  # Change to 'uat' if you have UAT branch
            )
            
            print(f"\n{'='*60}")
            print(f"Component: {component_name}")
            print(f"Type: {component_type}")
            print(f"Prod exists: {prod_content is not None}")
            print(f"UAT exists: {uat_content is not None}")
            
            if prod_content and uat_content:
                print(f"Prod size: {len(prod_content)} chars")
                print(f"UAT size: {len(uat_content)} chars")
                print(f"Are identical: {prod_content == uat_content}")
    
            if prod_content != uat_content:
                # Show first difference
                for i, (c1, c2) in enumerate(zip(prod_content, uat_content)):
                    if c1 != c2:
                        print(f"First diff at position {i}: '{c1}' vs '{c2}'")
                        print(f"Context: ...{prod_content[max(0,i-20):i+20]}...")
                        break
            print(f"{'='*60}\n")

            # Determine status
            if prod_content is None and uat_content is None:
                status = 'NOT_FOUND'
            elif prod_content is None:
                status = 'NEW'
            elif uat_content is None:
                status = 'REMOVED'
            elif prod_content == uat_content:
                status = 'IDENTICAL'
            else:
                status = 'MODIFIED'
            
            comparison_results.append({
                'component_name': component_name,
                'component_type': component_type,
                'status': status,
                'in_production': prod_content is not None,
                'in_uat': uat_content is not None,
                'file_path': prod_path or uat_path
            })
        
        # Calculate summary
        summary = {
            'total': len(comparison_results),
            'modified': len([r for r in comparison_results if r['status'] == 'MODIFIED']),
            'new': len([r for r in comparison_results if r['status'] == 'NEW']),
            'identical': len([r for r in comparison_results if r['status'] == 'IDENTICAL']),
            'removed': len([r for r in comparison_results if r['status'] == 'REMOVED']),
            'not_found': len([r for r in comparison_results if r['status'] == 'NOT_FOUND'])
        }
        
        return jsonify({
            'success': True,
            'comparison': comparison_results,
            'summary': summary,
            'compared_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_csv():
    """Analyze deployment with optional production comparison"""
    
    # Validate files
    if 'deployment_file' not in request.files:
        return jsonify({'error': 'No deployment file provided'}), 400
    
    deployment_file = request.files['deployment_file']
    production_file = request.files.get('production_file')
    
    if deployment_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Save deployment file
        deploy_filename = secure_filename(deployment_file.filename)
        deploy_path = os.path.join(app.config['UPLOAD_FOLDER'], deploy_filename)
        deployment_file.save(deploy_path)
        
        # Parse production state if provided
        prod_state = None
        if production_file and production_file.filename != '':
            prod_filename = secure_filename(production_file.filename)
            prod_path = os.path.join(app.config['UPLOAD_FOLDER'], prod_filename)
            production_file.save(prod_path)
            prod_state = parse_production_state(prod_path)
            os.remove(prod_path)
        
        # Parse deployment CSV
        parser = CopadoCSVParser()
        parsed_data = parser.parse_file(deploy_path)
        
        # Detect conflicts
        detector = ConflictDetector(parsed_data.user_stories)
        conflicts = detector.detect_conflicts()
        summary = detector.get_conflict_summary(conflicts)
        
        # Check for regressions
        regressions = []
        if prod_state:
            for story in parsed_data.user_stories:
                for component in story.components:
                    regression_check = check_regression(component, prod_state)
                    if regression_check and regression_check.get('is_regression'):
                        regressions.append({
                            'story_id': story.id,
                            'component': component.api_name,
                            **regression_check
                        })
        
        # Additional analyses
        story_conflicts = detector.analyze_story_to_story_conflicts()
        dev_coordination = detector.get_developer_coordination_map()
        deployment_sequence = detector.get_deployment_sequence(conflicts)
        
        # Clean up
        os.remove(deploy_path)
        
        # Build response
        response = {
            'success': True,
            'data': {
                'summary': {
                    'total_records': parsed_data.total_records,
                    'unique_stories': parsed_data.unique_stories,
                    'unique_components': parsed_data.unique_components,
                    'total_conflicts': summary['total_conflicts'],
                    'affected_stories': summary['affected_stories'],
                    'avg_risk_score': round(summary['avg_risk_score'], 1),
                    'severity_breakdown': summary['severity_breakdown'],
                    'total_regressions': len(regressions),
                    'production_check': prod_state is not None
                },
                'all_stories': [  # ADD THIS NEW FIELD
                    {
                        'id': story.id,
                        'title': story.title,
                        'developer': story.developer,
                        'jira_key': story.jira_key,
                        'component_count': len(story.components),
                        'components': [
                            {
                                'api_name': c.api_name,
                                'type': c.type.value,
                                'status': c.status.value if hasattr(c.status, 'value') else str(c.status),
                                'last_commit_date': c.last_commit_date.isoformat() if c.last_commit_date else None
                            }
                            for c in story.components
                        ]
                    }
                for story in parsed_data.user_stories
                    ],
                'conflicts': [format_conflict(c) for c in conflicts[:20]],
                'regressions': regressions,
                'story_conflicts': story_conflicts[:10],
                'developer_coordination': dev_coordination,
                'deployment_sequence': deployment_sequence
            }
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        if 'deploy_path' in locals() and os.path.exists(deploy_path):
            os.remove(deploy_path)
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def format_conflict(conflict):
    """Format ConflictingComponent object for JSON response"""
    
    # Format stories with commit info
    stories_detailed = []
    from conflict_detector import ConflictDetector
    detector = ConflictDetector([])
    recommendation = detector.get_recommendation(conflict)
    
    # Check if we have the new field
    if hasattr(conflict, 'stories_with_commit_info') and conflict.stories_with_commit_info:
        for item in conflict.stories_with_commit_info:
            story = item['story']
            commit_date = item['commit_date']
            created_by = item['created_by']
            
            stories_detailed.append({
                'id': story.id,
                'title': story.title,
                'developer': story.developer,
                'jira_key': story.jira_key,
                'component_count': len(story.components),
                'commit_date': commit_date.isoformat() if commit_date else None,
                'created_by': created_by,
                'days_ago': (datetime.now(commit_date.tzinfo) - commit_date).days if commit_date else None
            })
    else:
        # Fallback to old format
        for story in conflict.involved_stories:
            stories_detailed.append({
                'id': story.id,
                'title': story.title,
                'developer': story.developer,
                'jira_key': story.jira_key,
                'component_count': len(story.components),
                'commit_date': None,
                'created_by': None,
                'days_ago': None
            })
    
    return {
        'component': {
            'api_name': conflict.component.api_name,
            'type': conflict.component.type.value,
            'status': conflict.component.status.value
        },
        'involved_stories': [
            {
                'id': story.id,
                'title': story.title,
                'developer': story.developer,
                'jira_key': story.jira_key,
                'component_count': len(story.components),
                'commit_date': next(  # ADD THIS
                    (c.last_commit_date.isoformat() if c.last_commit_date else None
                     for c in story.components 
                     if c.api_name == conflict.component.api_name), 
                    None
                ),
                'created_by': story.metadata.created_by if hasattr(story, 'metadata') else 'Unknown',
                'days_ago': (datetime.now(conflict.component.last_commit_date.tzinfo) - conflict.component.last_commit_date).days if conflict.component.last_commit_date else 0
            }
            for story in conflict.involved_stories
        ],
        'risk_score': conflict.risk_score,
        'severity': conflict.severity.name,
        'involved_stories': stories_detailed,
        'risk_factors': conflict.risk_factors,
        'recommendation': recommendation
    }

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Copado Deployment Validator API")
    print("=" * 60)
    print("Starting server on http://localhost:5000")
    print()
    print("Available endpoints:")
    print("  GET  /api/health  - Health check")
    print("  POST /api/analyze - Upload CSV for analysis")
    print()
    print("Press Ctrl+C to stop")
    print("=" * 60)
    
    app.run(debug=True, host='0.0.0.0', port=5000)