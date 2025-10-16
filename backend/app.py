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

import logging
logging.basicConfig(level=logging.INFO)  # put once (e.g., in app.py main)
logger = logging.getLogger(__name__)



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

@app.route('/api/check-commit-relationship', methods=['POST'])
def check_commit_relationship():
    """
    Check if one commit includes another's changes
    """
    try:
        data = request.json
        commit1 = data.get('commit1', '')  # Older
        commit2 = data.get('commit2', '')  # Newer
        
        if not commit1 or not commit2:
            return jsonify({
                'success': False,
                'error': 'Both commits required'
            }), 400
        
        git_client = BitBucketClient()
        result = git_client.check_commit_ancestry(commit1, commit2)
        
        return jsonify(result)
        
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
    Get current state of components in a branch (defaults to 'uatsfdc').
    - Supports folder-based Vlocity bundles (e.g., Product2).
    - Supports single-file SF components.
    """
    try:
        data = request.json or {}
        components = data.get('components', [])
        branch = (data.get('branch') or 'uatsfdc').strip()

        if not components:
            return jsonify({'success': False, 'error': 'No components provided'}), 400

        git_client = BitBucketClient()
        app.logger.info("get_production_state 1: branch=%s components=%d", branch, len(components))
        production_state = []

        # Only strip the "<Type>." prefix (keep other dots)
        def normalize_name(name: str, ctype: str) -> str:
            name = (name or '').strip()
            pfx = f"{(ctype or '').strip()}."
            return name[len(pfx):] if name.startswith(pfx) else name

        # Folder-based Vlocity bundle types
        bundle_types = {
                "Product2",
                "OrchestrationItemDefinition",
                "OrchestrationDependencyDefinition",
                "CalculationMatrixVersion",
                "CalculationMatrix",
                "Catalog",
                "PriceList",
                "AttributeCategory",
            }

        for component in components:
            raw_name = component.get('name', '')
            ctype = component.get('type', '')

            # Ensure these always exist for this iteration
            latest_commit = None
            file_size = 0
            file_path = None

            name = normalize_name(raw_name, ctype)
            app.logger.info("component: type=%s raw=%s norm=%s", ctype, raw_name, name)

            # --- Vlocity bundle path (folder-based) ---
            if ctype in bundle_types:
                folder_path, items = git_client.resolve_vlocity_bundle(
                    branch=branch, component_type=ctype, component_name=raw_name
                )

                exists = folder_path is not None  # folder presence = exists in prod

                # Count JSON files (optional signal)
                json_count = 0
                if items and isinstance(items, list):
                    json_count = sum(
                        1
                        for it in items
                        if it.get("type") == "commit_file" and str(it.get("path", "")).endswith(".json")
                    )

                # Last commit touching anything under this folder
                if exists:
                    commits = git_client.get_file_commits(folder_path.rstrip("/"), branch=branch, limit=1)
                    latest_commit = commits[0] if commits else None

                production_state.append({
                    'component_name': raw_name,
                    'component_type': ctype,
                    'file_path': folder_path,                 # bundle folder path
                    'exists_in_prod': exists,
                    'last_commit_hash': latest_commit['short_hash'] if latest_commit else None,
                    'last_commit_date': latest_commit['date'] if latest_commit else None,
                    'last_author': latest_commit['author'] if latest_commit else None,
                    'last_commit_message': latest_commit['message'] if latest_commit else None,
                    'file_size': 0,                           # bundles: no single file size
                    'has_files': json_count > 0,
                    'file_count': json_count,
                })
                continue  # next component

            # --- Salesforce single-file path (file-based) ---
            content, actual_path = git_client.get_file_content_smart(name, ctype, branch=branch)
            file_path = actual_path or git_client.build_component_path(name, ctype)

            # Latest commit for this *file* on the same branch
            if file_path:
                commits = git_client.get_file_commits(file_path, branch=branch, limit=1)
                latest_commit = commits[0] if commits else None

            file_size = len(content) if content else 0

            production_state.append({
                'component_name': raw_name,            # original name user sent
                'component_type': ctype,
                'file_path': file_path,
                'exists_in_prod': content is not None,
                'last_commit_hash': latest_commit['short_hash'] if latest_commit else None,
                'last_commit_date': latest_commit['date'] if latest_commit else None,
                'last_author': latest_commit['author'] if latest_commit else None,
                'last_commit_message': latest_commit['message'] if latest_commit else None,
                'file_size': file_size,
            })

        return jsonify({
            'success': True,
            'production_state': production_state,
            'checked_at': datetime.now().isoformat(),
            'branch': branch,
            'total_components': len(production_state),
            'existing': sum(1 for c in production_state if c['exists_in_prod']),
            'missing': sum(1 for c in production_state if not c['exists_in_prod']),
        })

    except Exception as e:
        app.logger.exception("Error in /api/production-state")
        return jsonify({'success': False, 'error': str(e)}), 500


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

@app.route('/api/verify-commit', methods=['POST'])
def verify_commit():
    """
    Verify if commit exists in production
    
    Request: {
        "commit_hash": "910e4e2",
        "branch": "master"
    }
    """
    try:
        data = request.json
        commit_hash = data.get('commit_hash', '')
        branch = data.get('branch', 'master')
        
        git_client = BitBucketClient()
        result = git_client.verify_commit_in_branch(commit_hash, branch)
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/get-commit-changes', methods=['POST'])
def get_commit_changes():
    """
    Get what changed in a specific commit
    """
    try:
        data = request.json
        commit_hash = data.get('commit_hash', '')
        
        if not commit_hash:
            return jsonify({
                'success': False,
                'error': 'No commit hash provided'
            }), 400
        
        git_client = BitBucketClient()
        result = git_client.get_commit_changes(commit_hash)
        
        return jsonify(result)
        
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
                                'last_commit_date': c.last_commit_date.isoformat() if c.last_commit_date else None,
                                'commit_hash': c.commit_hash if hasattr(c, 'commit_hash') else None 
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