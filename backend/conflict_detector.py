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
            return {
                'action': 'DEPLOY IN SEQUENCE',
                'priority': 'HIGH',
                'steps': [
                    f'Deploy stories in order (latest first: {latest_story.id if latest_story else "Unknown"})',
                    'Test each deployment before next',
                    f'Notify all {stories_count} developers of deployment order',
                    'Have rollback plan ready'
                ],
                'risk': 'Conflicts likely - careful sequencing required'
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