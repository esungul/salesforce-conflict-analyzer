"""
Conflict Detection Engine

Analyzes user stories to find components touched by multiple stories.
Calculates risk scores and severity levels.
"""
from datetime import datetime
from typing import List, Dict
from collections import defaultdict
from models import (
    UserStory, Component, ConflictingComponent,
    ConflictSeverity, ConflictStatus, MetadataType
)


class ConflictDetector:
    """
    Detects conflicts between user stories
    
    Usage:
        detector = ConflictDetector(user_stories)
        conflicts = detector.detect_conflicts()
        high_risk = [c for c in conflicts if c.severity.value >= ConflictSeverity.HIGH.value]
    """
    def get_recommendation(self, conflict: ConflictingComponent) -> dict:
        """Generate actionable recommendation based on conflict analysis"""
        
        severity = conflict.severity
        stories_count = len(conflict.involved_stories)
        latest_story = conflict.stories_with_commit_info[0]['story'] if conflict.stories_with_commit_info else None
        
        if severity == ConflictSeverity.BLOCKER:
            return {
                'action': 'MANUAL MERGE REQUIRED',
                'priority': 'IMMEDIATE',
                'steps': [
                    f'Stop: Do NOT auto-deploy this component',
                    f'Coordinate meeting with all {stories_count} developers',
                    f'Manual code review and merge required',
                    f'Deploy as single coordinated release',
                    'Extensive testing in UAT before production'
                ],
                'risk': 'High probability of production failure if not manually merged'
            }
        
        elif severity == ConflictSeverity.CRITICAL:
            latest_story = conflict.stories_with_commit_info[-1]['story'] if conflict.stories_with_commit_info else None  # OLDEST now
            oldest_story = conflict.stories_with_commit_info[-1]['story'] if conflict.stories_with_commit_info else None
            return {
                'action': 'DEPLOY IN SEQUENCE',
                'priority': 'HIGH',
                'steps': [
                    f'Deploy stories in chronological order (oldest first: {oldest_story.id if oldest_story else "Unknown"})',
                    'Test each deployment thoroughly before proceeding',
                    f'Coordinate with all {stories_count} developers on deployment timeline',
                    'Have rollback plan ready for each step'
                ],
                'risk': 'Conflicts likely - strict chronological sequencing required'
            }
                    
        
        elif severity == ConflictSeverity.HIGH:
            return {
                'action': 'REVIEW BEFORE DEPLOY',
                'priority': 'MEDIUM',
                'steps': [
                    'Code review of overlapping changes',
                    'Deploy in recommended order',
                    'Monitor for issues in lower environments first'
                ],
                'risk': 'Moderate risk - review recommended'
            }
        
        elif severity == ConflictSeverity.MEDIUM:
            return {
                'action': 'STANDARD DEPLOYMENT',
                'priority': 'LOW',
                'steps': [
                    'Follow normal deployment process',
                    'Quick review of changes',
                    'Standard testing procedures'
                ],
                'risk': 'Low risk - proceed with caution'
            }
        
        else:  # LOW
            return {
                'action': 'SAFE TO DEPLOY',
                'priority': 'NONE',
                'steps': [
                    'No special action needed',
                    'Deploy normally'
                ],
                'risk': 'Minimal risk'
            }
    
    def analyze_story_to_story_conflicts(self) -> List[dict]:
        """Find which stories conflict with each other across multiple components"""
        story_conflicts = []
        
        for i, story1 in enumerate(self.user_stories):
            for story2 in self.user_stories[i+1:]:
                # Find shared components
                comps1 = {c.api_name for c in story1.components}
                comps2 = {c.api_name for c in story2.components}
                shared = comps1 & comps2
                
                if len(shared) > 0:
                    story_conflicts.append({
                        'story1_id': story1.id,
                        'story1_developer': story1.developer,
                        'story2_id': story2.id,
                        'story2_developer': story2.developer,
                        'shared_count': len(shared),
                        'shared_components': list(shared),
                        'needs_coordination': story1.developer != story2.developer
                    })
        
        return sorted(story_conflicts, key=lambda x: x['shared_count'], reverse=True)


    def get_developer_coordination_map(self) -> dict:
        """Who needs to coordinate with whom"""
        dev_map = {}
        story_conflicts = self.analyze_story_to_story_conflicts()
        
        for conflict in story_conflicts:
            dev1 = conflict['story1_developer'] or 'Unknown'
            dev2 = conflict['story2_developer'] or 'Unknown'
            
            if dev1 not in dev_map:
                dev_map[dev1] = {'coordinates_with': set(), 'shared_components': 0}
            if dev2 not in dev_map:
                dev_map[dev2] = {'coordinates_with': set(), 'shared_components': 0}
            
            if dev1 != dev2:
                dev_map[dev1]['coordinates_with'].add(dev2)
                dev_map[dev2]['coordinates_with'].add(dev1)
                dev_map[dev1]['shared_components'] += conflict['shared_count']
                dev_map[dev2]['shared_components'] += conflict['shared_count']
        
        # Convert sets to lists for JSON
        return {
            dev: {
                'coordinates_with': list(data['coordinates_with']),
                'shared_components': data['shared_components']
            }
            for dev, data in dev_map.items()
        }


    def get_deployment_sequence(self, conflicts: List) -> List[dict]:
        """Recommend deployment order based on dependencies"""
        # Group stories by their latest commit date
        story_dates = {}
        for conflict in conflicts:
            if hasattr(conflict, 'stories_with_commit_info'):
                for item in conflict.stories_with_commit_info:
                    story_id = item['story'].id
                    commit_date = item['commit_date']
                    if story_id not in story_dates or (commit_date and commit_date > story_dates[story_id]):
                        story_dates[story_id] = commit_date
        
        # Sort by date
        sorted_stories = sorted(story_dates.items(), key=lambda x: x[1] if x[1] else datetime.min)
        
        batches = []
        current_batch = []
        last_date = None
        
        for story_id, date in sorted_stories:
            if last_date and date and (last_date - date).days > 7:
                # New batch if >7 days gap
                if current_batch:
                    batches.append(current_batch)
                current_batch = [story_id]
            else:
                current_batch.append(story_id)
            last_date = date
        
        if current_batch:
            batches.append(current_batch)
        
        return [{'batch_number': i+1, 'stories': batch, 'note': f'Deploy batch {i+1}, wait 2 hours before next'} 
                for i, batch in enumerate(batches)]
        
    def __init__(self, user_stories: List[UserStory]):
        """
        Initialize detector with user stories
        
        Args:
            user_stories: List of UserStory objects to analyze
        """
        self.user_stories = user_stories
        
        # Critical component types that increase risk
        self.critical_types = [
            MetadataType.APEX_CLASS,
            MetadataType.INTEGRATION_PROCEDURE,
            MetadataType.FLOW
        ]
    
    def detect_conflicts(self) -> List[ConflictingComponent]:
        """
        Find all conflicts and calculate risk scores
        
        Returns:
            List of ConflictingComponent objects, sorted by severity (highest first)
        """
        # Step 1: Build component index
        component_index = self._build_component_index()
        
        # Step 2: Find components touched by multiple stories
        conflicts = []
        for api_name, data in component_index.items():
            if len(data['stories']) >= 2:
                conflict = self._analyze_conflict(data)
                conflicts.append(conflict)
        
        # Step 3: Sort by risk score (highest first)
        conflicts.sort(key=lambda c: c.risk_score, reverse=True)
        
        return conflicts
    
    def _build_component_index(self) -> Dict:
        """Build index: component_name -> {component, stories, developers}"""
        index = defaultdict(lambda: {
            'component': None,
            'stories': [],
            'developers': set(),
            'all_components': []  # ADD THIS - store all component instances
        })
        
        for story in self.user_stories:
            for component in story.components:
                data = index[component.api_name]
                
                # Store ALL component instances (not just first)
                data['all_components'].append(component)  # ADD THIS
                
                # Store component (use first occurrence)
                if data['component'] is None:
                    data['component'] = component
                
                # Add story
                data['stories'].append(story)
                
                # Add developer
                if story.developer:
                    data['developers'].add(story.developer)
        
        return index
    
    def _analyze_conflict(self, data: Dict) -> ConflictingComponent:
        """
        Analyze a single conflict and calculate risk
        
        Args:
            data: Dictionary with component, stories, developers
            
        Returns:
            ConflictingComponent with risk score and factors
        """
        component = data['component']
        stories = data['stories']
        developers = data['developers']
        all_components = data.get('all_components', [])
        latest_component = max(
        all_components,
        key=lambda c: c.last_commit_date if c.last_commit_date else datetime.min,
        default=component
            )
        
        risk_factors = []
        risk_score = 0
        
        # Factor 1: Multiple developers (communication overhead)
        if len(developers) > 1:
            factor = f"{len(developers)} different developers"
            risk_factors.append(factor)
            risk_score += 20
        
        # Factor 2: Critical component type
        if component.type in self.critical_types:
            factor = f"Critical component type ({component.type.value})"
            risk_factors.append(factor)
            risk_score += 25
        
        # Factor 3: Copado flagged as potential conflict
        if component.status == ConflictStatus.POTENTIAL_CONFLICT:
            factor = "Copado flagged as Potential Conflict"
            risk_factors.append(factor)
            risk_score += 30
        
        # Factor 4: Many stories touching same component
        if len(stories) >= 3:
            factor = f"{len(stories)} stories modifying same component"
            risk_factors.append(factor)
            risk_score += 20
        
        # Factor 5: Recent changes (if we have commit date)
        if component.last_commit_date:
            # This would require datetime calculation - skip for now
            pass
        
        # NEW: Get commit info for each story (sorted by date)
        stories_with_dates = []
        for story in stories:
            # Find this component in the story
            story_component = next(
                (c for c in story.components if c.api_name == component.api_name),
                None
            )
            stories_with_dates.append({
                'story': story,
                'commit_date': story_component.last_commit_date if story_component else None,
                'created_by': story_component.created_by if story_component else None
            })
        
        # Sort by commit date (newest first)
        stories_with_dates.sort(
            key=lambda x: x['commit_date'] if x['commit_date'] else datetime.min,
            reverse=True
        )
        
        # Calculate severity
        severity = self._calculate_severity(risk_score)
        
        return ConflictingComponent(
            component=latest_component,
            involved_stories=stories,
            severity=severity,
            risk_factors=risk_factors,
            risk_score=risk_score,
            stories_with_commit_info=stories_with_dates
        )
    def _calculate_severity(self, risk_score: int) -> ConflictSeverity:
        """
        Map risk score to severity level
        
        Args:
            risk_score: Total risk score (0-100+)
            
        Returns:
            ConflictSeverity enum
        """
        if risk_score >= 80:
            return ConflictSeverity.BLOCKER
        elif risk_score >= 60:
            return ConflictSeverity.CRITICAL
        elif risk_score >= 40:
            return ConflictSeverity.HIGH
        elif risk_score >= 20:
            return ConflictSeverity.MEDIUM
        else:
            return ConflictSeverity.LOW
    
    def get_conflict_summary(self, conflicts: List[ConflictingComponent]) -> Dict:
        """
        Generate summary statistics
        
        Args:
            conflicts: List of conflicts
            
        Returns:
            Dictionary with summary stats
        """
        severity_counts = {
            'blocker': 0,
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0
        }
        
        for conflict in conflicts:
            if conflict.severity == ConflictSeverity.BLOCKER:
                severity_counts['blocker'] += 1
            elif conflict.severity == ConflictSeverity.CRITICAL:
                severity_counts['critical'] += 1
            elif conflict.severity == ConflictSeverity.HIGH:
                severity_counts['high'] += 1
            elif conflict.severity == ConflictSeverity.MEDIUM:
                severity_counts['medium'] += 1
            else:
                severity_counts['low'] += 1
        
        # Get affected stories
        affected_stories = set()
        for conflict in conflicts:
            for story in conflict.involved_stories:
                affected_stories.add(story.id)
        
        return {
            'total_conflicts': len(conflicts),
            'severity_breakdown': severity_counts,
            'affected_stories': len(affected_stories),
            'avg_risk_score': sum(c.risk_score for c in conflicts) / len(conflicts) if conflicts else 0
        }