"""
IMPLEMENTATION: UI-Friendly Bulk Response
==========================================

This transforms the verbose validation response into a clean, UI-friendly format
"""

# =============================================================================
# ADD TO deployment_prover.py
# =============================================================================

def format_bulk_response(self, results: List[Dict], start_time: datetime) -> Dict:
    """
    Transform verbose results into UI-friendly format for bulk operations
    
    Args:
        results: List of individual story proof results
        start_time: When processing started
        
    Returns:
        UI-friendly response structure
    """
    execution_time = str(datetime.now() - start_time)
    
    # Aggregate statistics
    total_stories = len(results)
    proven_count = sum(1 for r in results if r.get('overall_proof', {}).get('verdict') == 'PROVEN')
    partial_count = sum(1 for r in results if r.get('overall_proof', {}).get('verdict') in ['LIKELY PROVEN', 'POSSIBLY PROVEN'])
    unproven_count = sum(1 for r in results if r.get('overall_proof', {}).get('verdict') == 'UNPROVEN')
    
    # Component statistics
    total_components = sum(r.get('summary', {}).get('total_components', 0) for r in results)
    proven_components = sum(r.get('summary', {}).get('proven_components', 0) for r in results)
    
    # Component types
    component_types = {}
    for result in results:
        for comp in result.get('component_proofs', []):
            comp_type = comp.get('component', {}).get('type', 'Unknown')
            component_types[comp_type] = component_types.get(comp_type, 0) + 1
    
    # Build UI-friendly story list
    stories = []
    all_authors = set()
    all_statuses = set()
    date_range = {'earliest': None, 'latest': None}
    errors = []
    
    for result in results:
        try:
            story_summary = self._format_story_summary(result)
            stories.append(story_summary)
            
            # Collect for filters
            all_authors.add(story_summary['commit']['author'])
            all_statuses.add(story_summary['status'])
            
            # Track date range
            commit_date = story_summary['commit']['date']
            if date_range['earliest'] is None or commit_date < date_range['earliest']:
                date_range['earliest'] = commit_date
            if date_range['latest'] is None or commit_date > date_range['latest']:
                date_range['latest'] = commit_date
                
        except Exception as e:
            story_id = result.get('stories', {}).get('requested', ['Unknown'])[0]
            errors.append({
                'story_id': story_id,
                'error_type': 'formatting_error',
                'message': str(e),
                'severity': 'warning'
            })
    
    # Build response
    return {
        'overview': {
            'total_stories': total_stories,
            'processing_time': execution_time,
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'proven': proven_count,
                'unproven': unproven_count,
                'partial': partial_count,
                'success_rate': round((proven_count / total_stories * 100) if total_stories > 0 else 0, 1)
            },
            'validation_summary': {
                'all_validators_passed': sum(1 for r in results 
                    if r.get('validation', {}).get('failed', 0) == 0),
                'some_validators_failed': sum(1 for r in results 
                    if r.get('validation', {}).get('failed', 0) > 0),
                'critical_failures': unproven_count
            },
            'component_summary': {
                'total_components': total_components,
                'proven_components': proven_components,
                'unproven_components': total_components - proven_components,
                'component_types': component_types
            }
        },
        'stories': stories,
        'filters': {
            'statuses': sorted(list(all_statuses)),
            'environments': list(set(r.get('environment') for r in results)),
            'component_types': sorted(component_types.keys()),
            'authors': sorted(list(all_authors)),
            'date_range': date_range
        },
        'errors': errors if errors else []
    }


def _format_story_summary(self, result: Dict) -> Dict:
    """
    Format a single story result into UI-friendly summary
    
    Args:
        result: Full story proof result
        
    Returns:
        Compact story summary for list/table view
    """
    overall_proof = result.get('overall_proof', {})
    validation = result.get('validation', {})
    summary = result.get('summary', {})
    
    # Get story info
    story_names = result.get('stories', {}).get('valid', [])
    story_id = story_names[0] if story_names else 'Unknown'
    
    # Get commit info
    commits = result.get('commits', [])
    commit_sha = commits[0] if commits else None
    
    commit_info = self._extract_commit_info(result, commit_sha)
    
    # Get validation results
    validators = self._format_validators(validation.get('results', []))
    
    # Get components
    components = self._format_components(result.get('component_proofs', []))
    
    # Extract notes preview
    notes_preview = self._extract_notes_preview(validation.get('results', []))
    
    # Determine status
    verdict = overall_proof.get('verdict', 'UNPROVEN')
    if verdict == 'PROVEN':
        status = 'proven'
    elif verdict in ['LIKELY PROVEN', 'POSSIBLY PROVEN']:
        status = 'partial'
    else:
        status = 'unproven'
    
    return {
        'story_id': story_id,
        'story_name': story_id,
        'story_url': f"https://jira.company.com/browse/{story_id}",  # Configure this
        'status': status,
        'confidence': overall_proof.get('confidence', 'unknown'),
        'proof_score': overall_proof.get('score', 0.0),
        'metrics': {
            'components_total': summary.get('total_components', 0),
            'components_proven': summary.get('proven_components', 0),
            'validators_passed': validation.get('successful', 0),
            'validators_failed': validation.get('failed', 0),
            'validators_total': validation.get('validators_executed', 0)
        },
        'commit': commit_info,
        'environment': result.get('environment', 'unknown'),
        'execution_time': result.get('execution_time', '0:00:00'),
        'execution_time_ms': self._parse_execution_time_ms(result.get('execution_time', '0:00:00')),
        'components': components,
        'validation': {
            'status': 'passed' if validation.get('failed', 0) == 0 else 'failed',
            'validators': validators
        },
        'notes_preview': notes_preview,
        'details_url': f"/api/deployment/prove/story/{story_id}/details"
    }


def _extract_commit_info(self, result: Dict, commit_sha: str) -> Dict:
    """Extract commit information from validation results"""
    # Try to get from commit_exists validator
    validation_results = result.get('validation', {}).get('results', [])
    
    for validator in validation_results:
        if validator.get('validator') == 'commit_exists' and validator.get('status') == 'success':
            details = validator.get('details', {})
            return {
                'sha': commit_sha[:8] if commit_sha else 'unknown',
                'sha_full': commit_sha or 'unknown',
                'author': details.get('author', 'Unknown'),
                'date': details.get('date', ''),
                'message': details.get('message', ''),
                'url': f"https://bitbucket.org/workspace/repo/commits/{commit_sha}" if commit_sha else ''
            }
    
    # Fallback
    return {
        'sha': commit_sha[:8] if commit_sha else 'unknown',
        'sha_full': commit_sha or 'unknown',
        'author': 'Unknown',
        'date': '',
        'message': '',
        'url': ''
    }


def _format_validators(self, validation_results: List[Dict]) -> List[Dict]:
    """Format validator results for compact display"""
    validators = []
    
    status_icons = {
        'success': '✅',
        'warning': '⚠️',
        'failed': '❌',
        'skipped': '⊘'
    }
    
    for validator in validation_results:
        validators.append({
            'name': validator.get('validator', 'unknown'),
            'status': validator.get('status', 'unknown'),
            'icon': status_icons.get(validator.get('status', 'unknown'), '?')
        })
    
    return validators


def _format_components(self, component_proofs: List[Dict]) -> List[Dict]:
    """Format component proofs for compact display"""
    components = []
    
    for proof in component_proofs[:10]:  # Limit to first 10 for summary
        component = proof.get('component', {})
        components.append({
            'name': component.get('api_name', 'Unknown'),
            'type': component.get('type', 'Unknown'),
            'proven': proof.get('proven', False),
            'confidence': proof.get('confidence', 'unknown')
        })
    
    return components


def _extract_notes_preview(self, validation_results: List[Dict]) -> List[str]:
    """Extract first few lines from commit_contents notes for preview"""
    for validator in validation_results:
        if validator.get('validator') == 'commit_contents':
            notes = validator.get('notes', [])
            # Return first 3-5 lines
            return notes[:5] if notes else []
    
    return []


def _parse_execution_time_ms(self, execution_time: str) -> int:
    """Convert execution time string to milliseconds"""
    try:
        # Format: "0:00:02.155713"
        parts = execution_time.split(':')
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return int((hours * 3600 + minutes * 60 + seconds) * 1000)
    except:
        pass
    return 0


# =============================================================================
# ADD NEW BULK ENDPOINT TO app.py
# =============================================================================

@app.route('/api/deployment/prove/bulk', methods=['POST'])
def prove_deployment_bulk():
    """
    Bulk deployment proof for multiple stories
    
    Request:
    {
        "story_names": ["US-0033638", "US-0033639", ...],
        "target_env": "production",
        "target_branch": "master",
        "validation_level": "standard",
        "format": "ui"  // "ui" for UI-friendly, "verbose" for detailed
    }
    
    Response: UI-friendly format (see UI_FRIENDLY_RESPONSE_STRUCTURE.py)
    """
    try:
        data = request.get_json()
        
        story_names = data.get('story_names', [])
        target_env = data.get('target_env', 'production')
        target_branch = data.get('target_branch', 'master')
        validation_level = data.get('validation_level', 'standard')
        response_format = data.get('format', 'ui')
        
        if not story_names:
            return jsonify({'error': 'No story names provided'}), 400
        
        log.info(f"🚀 Bulk proof request for {len(story_names)} stories")
        
        start_time = datetime.now()
        
        # Process each story
        results = []
        for story_name in story_names:
            try:
                result = prover.prove_deployment(
                    story_names=[story_name],
                    target_env=target_env,
                    target_branch=target_branch,
                    validation_level=validation_level
                )
                results.append(result)
            except Exception as e:
                log.error(f"Error processing {story_name}: {e}")
                # Add error result
                results.append({
                    'stories': {'requested': [story_name], 'valid': [], 'invalid': [story_name]},
                    'overall_proof': {'verdict': 'UNPROVEN', 'confidence': 'very low', 'score': 0.0},
                    'summary': {'total_components': 0, 'proven_components': 0},
                    'error': str(e)
                })
        
        # Format response based on requested format
        if response_format == 'ui':
            response = prover.format_bulk_response(results, start_time)
        else:
            # Verbose format - return all results as-is
            response = {
                'total_stories': len(story_names),
                'processing_time': str(datetime.now() - start_time),
                'results': results
            }
        
        return jsonify(response)
        
    except Exception as e:
        log.error(f"Bulk proof error: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# PAGINATION SUPPORT (Optional)
# =============================================================================

@app.route('/api/deployment/prove/bulk', methods=['GET'])
def prove_deployment_bulk_paginated():
    """
    Paginated bulk proof results
    
    Query params:
    - page: Page number (default 1)
    - page_size: Items per page (default 50)
    - status: Filter by status (proven|unproven|partial)
    - author: Filter by author
    - date_from: Filter by date (ISO format)
    - date_to: Filter by date (ISO format)
    """
    # Implementation would retrieve from database/cache
    # This is a placeholder showing the structure
    pass


# =============================================================================
# STORY DETAILS ENDPOINT (For drill-down)
# =============================================================================

@app.route('/api/deployment/prove/story/<story_id>/details', methods=['GET'])
def get_story_details(story_id):
    """
    Get detailed information for a single story
    
    Returns:
    - Full validation results
    - Complete notes
    - All component details
    - Full diff content
    """
    try:
        # Run full validation
        result = prover.prove_deployment(
            story_names=[story_id],
            target_env=request.args.get('env', 'production'),
            target_branch=request.args.get('branch', 'master'),
            validation_level=request.args.get('validation_level', 'high')
        )
        
        return jsonify(result)
        
    except Exception as e:
        log.error(f"Error getting details for {story_id}: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# EXPORT ENDPOINT (For downloading results)
# =============================================================================

@app.route('/api/deployment/prove/bulk/export', methods=['POST'])
def export_bulk_results():
    """
    Export bulk results to CSV/Excel
    
    Request:
    {
        "story_names": [...],
        "format": "csv" | "excel",
        "target_env": "production"
    }
    
    Response: File download
    """
    try:
        data = request.get_json()
        story_names = data.get('story_names', [])
        export_format = data.get('format', 'csv')
        
        # Process stories
        results = []
        for story_name in story_names:
            result = prover.prove_deployment(
                story_names=[story_name],
                target_env=data.get('target_env', 'production')
            )
            results.append(result)
        
        # Convert to DataFrame
        import pandas as pd
        
        df_data = []
        for result in results:
            summary = prover._format_story_summary(result)
            df_data.append({
                'Story ID': summary['story_id'],
                'Status': summary['status'],
                'Score': summary['proof_score'],
                'Components': f"{summary['metrics']['components_proven']}/{summary['metrics']['components_total']}",
                'Validators': f"{summary['metrics']['validators_passed']}/{summary['metrics']['validators_total']}",
                'Author': summary['commit']['author'],
                'Date': summary['commit']['date'],
                'Environment': summary['environment']
            })
        
        df = pd.DataFrame(df_data)
        
        # Export based on format
        if export_format == 'excel':
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Deployment Proofs')
            output.seek(0)
            
            return send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=f'deployment_proofs_{datetime.now().strftime("%Y%m%d")}.xlsx'
            )
        else:
            # CSV
            output = StringIO()
            df.to_csv(output, index=False)
            output.seek(0)
            
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': f'attachment; filename=deployment_proofs_{datetime.now().strftime("%Y%m%d")}.csv'}
            )
        
    except Exception as e:
        log.error(f"Export error: {e}")
        return jsonify({'error': str(e)}), 500
