"""
Flask REST API for Copado Deployment Validator

Endpoints:
  POST /api/analyze - Upload CSV and get conflict analysis
  GET  /api/health  - Health check
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tempfile
from csv_parser import CopadoCSVParser
from conflict_detector import ConflictDetector
from models import ConflictSeverity

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


@app.route('/api/analyze', methods=['POST'])
def analyze_csv():
    """
    Analyze uploaded CSV file for conflicts
    
    Request:
        Multipart form data with 'file' field containing CSV
        
    Returns:
        JSON with conflict analysis results
    """
    # Validate request
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Only CSV files are allowed'}), 400
    
    try:
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Parse CSV
        parser = CopadoCSVParser()
        parsed_data = parser.parse_file(filepath)
        
        # Detect conflicts
        detector = ConflictDetector(parsed_data.user_stories)
        conflicts = detector.detect_conflicts()
        
        # Get summary
        summary = detector.get_conflict_summary(conflicts)
        
        # Clean up temp file
        os.remove(filepath)
        
        # Format response
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
                    'severity_breakdown': summary['severity_breakdown']
                },
                'conflicts': [format_conflict(c) for c in conflicts[:20]]  # Top 20
            }
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        # Clean up temp file if it exists
        if 'filepath' in locals() and os.path.exists(filepath):
            os.remove(filepath)
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def format_conflict(conflict):
    """
    Format ConflictingComponent object for JSON response
    
    Args:
        conflict: ConflictingComponent object
        
    Returns:
        Dictionary suitable for JSON serialization
    """
    return {
        'component': {
            'api_name': conflict.component.api_name,
            'type': conflict.component.type.value,
            'status': conflict.component.status.value
        },
        'risk_score': conflict.risk_score,
        'severity': conflict.severity.name,
        'involved_stories': [
            {
                'id': story.id,
                'title': story.title,
                'developer': story.developer
            }
            for story in conflict.involved_stories
        ],
        'risk_factors': conflict.risk_factors
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