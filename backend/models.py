"""
Data Models for Copado Deployment Validator

This defines the structure of our data using Python dataclasses.
Think of these as blueprints - like TypeScript interfaces.
"""

from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum
from datetime import datetime


# ==============================================================================
# ENUMS - Predefined Constants
# ==============================================================================

class MetadataType(Enum):
    """Types of Salesforce components"""
    APEX_CLASS = "ApexClass"
    INTEGRATION_PROCEDURE = "IntegrationProcedure"
    DATA_RAPTOR = "DataRaptor"
    OMNI_SCRIPT = "OmniScript"
    PERMISSION_SET = "PermissionSet"
    FLOW = "Flow"
    PRODUCT = "Product2"
    SYSTEM = "System"
    UNKNOWN = "Unknown"


class ConflictStatus(Enum):
    """Conflict status from Copado"""
    POTENTIAL_CONFLICT = "Potential Conflict"
    AUTO_RESOLVED = "Auto-resolved"
    BACK_PROMOTED = "Back Promoted"
    UNKNOWN = "Unknown"


class ConflictSeverity(Enum):
    """Risk severity levels - how dangerous is the conflict"""
    LOW = 0
    MEDIUM = 1
    HIGH = 2
    CRITICAL = 3
    BLOCKER = 4


# ==============================================================================
# DATA CLASSES - Our Domain Models
# ==============================================================================

@dataclass
class Component:
    """
    Represents a single Salesforce component (file)
    Example: ApexClass.OrderTriggerHelper
    """
    api_name: str
    type: MetadataType
    status: ConflictStatus
    user_story_id: str
    unique_id: str
    last_commit_date: Optional[datetime] = None


@dataclass
class UserStory:
    """
    Represents a Copado User Story
    Contains multiple components
    """
    id: str
    title: str
    jira_key: Optional[str] = None
    project: str = "Unknown"
    environment: str = "Unknown"
    developer: Optional[str] = None
    components: List[Component] = field(default_factory=list)


@dataclass
class ConflictingComponent:
    """
    A component that has conflicts between multiple stories
    This is what our analyzer produces
    """
    component: Component
    involved_stories: List[UserStory]
    severity: ConflictSeverity
    risk_factors: List[str] = field(default_factory=list)
    risk_score: int = 0


@dataclass
class ParsedData:
    """
    The complete result after parsing CSV
    """
    user_stories: List[UserStory]
    components: List[Component]
    total_records: int
    unique_stories: int
    unique_components: int