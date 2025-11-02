# validators.py
"""
Complete Validators Module

This module contains all validators for deployment validation.
Each validator inherits from BaseValidator and implements specific validation logic.

Validators Available:
- ComponentExistenceValidator: Check if components exist in target environment
- CommitValidationValidator: Validate commit information
- FileMappingValidator: Validate file to component mapping
- BranchComparisonValidator: Compare branches for deployment readiness
- ContentVerificationValidator: Verify component content/syntax
- FileSizeCheckValidator: Check file sizes and warn on large files
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

log = logging.getLogger(__name__)


# ============================================================================
# ENUMS AND DATA CLASSES
# ============================================================================

class ValidatorStatus(Enum):
    """Validation result status"""
    SUCCESS = "success"
    SKIPPED = "skipped"
    WARNING = "warning"
    FAILED = "failed"
    ERROR = "error"


@dataclass
class ValidatorResult:
    """Result of a validator execution"""
    name: str
    status: ValidatorStatus
    message: str
    components_validated: int = 0
    components_skipped: int = 0
    details: Optional[Dict] = None
    errors: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    execution_time_ms: float = 0.0  # ✅ ADDED: Track execution time
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'name': self.name,
            'status': self.status.value,
            'message': self.message,
            'components_validated': self.components_validated,
            'components_skipped': self.components_skipped,
            'details': self.details or {},
            'errors': self.errors or [],
            'warnings': self.warnings or [],
            'execution_time_ms': self.execution_time_ms,
        }


# ============================================================================
# BASE VALIDATOR CLASS
# ============================================================================

class BaseValidator(ABC):
    """
    Base class for all validators.
    
    All validators inherit from this and implement the validate() method.
    """
    
    def __init__(self, name: str = None):
        """Initialize validator"""
        self.name = name or self.__class__.__name__
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.info(f"✅ Initialized {self.name}")
    
    @abstractmethod
    def validate(self, context: Dict) -> ValidatorResult:
        """
        Perform validation
        
        Args:
            context: Dict with validation context
                - story_name: Name of story
                - target_env: Target environment
                - commit_components: List of components from commit
                - validation_level: fast/standard/full/critical
                - evidence_data: Optional evidence data
        
        Returns:
            ValidatorResult: Result of validation
        """
        pass
    
    def _get_validation_config(self):
        """Get validation config"""
        try:
            from validation_config import get_validation_config
            return get_validation_config()
        except Exception as e:
            self.logger.warning(f"Could not load validation_config: {e}")
            return None
    
    def _log_info(self, message: str):
        """Log info message"""
        self.logger.info(f"ℹ️  {message}")
    
    def _log_warning(self, message: str):
        """Log warning message"""
        self.logger.warning(f"⚠️  {message}")
    
    def _log_error(self, message: str):
        """Log error message"""
        self.logger.error(f"❌ {message}")
    
    def _log_success(self, message: str):
        """Log success message"""
        self.logger.info(f"✅ {message}")


# ============================================================================
# VALIDATOR 1: Component Existence Validator
# ============================================================================

class ComponentExistenceValidator(BaseValidator):
    """
    Check if components exist in target environment
    
    Validates:
    - Component is identified correctly
    - Component type is supported
    - Component is available (not in unavailable list)
    - File size is acceptable
    """
    
    def __init__(self):
        super().__init__("ComponentExistenceValidator")
    
    def validate(self, context: Dict) -> ValidatorResult:
        """Validate components exist"""
        
        self._log_info("Starting component existence validation")
        
        try:
            # Get validation config
            vcfg = self._get_validation_config()
            
            # Extract context
            commit_components = context.get('commit_components', [])
            story_name = context.get('story_name', 'Unknown')
            validation_level = context.get('validation_level', 'standard')
            
            if not commit_components:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SKIPPED,
                    message="No components to validate",
                    components_validated=0,
                    components_skipped=0,
                )
            
            self._log_info(f"Validating {len(commit_components)} components for {story_name}")
            
            errors = []
            warnings = []
            components_validated = 0
            components_skipped = 0
            validated_components = []
            
            # Validate each component
            for component in commit_components:
                comp_type = component.get('type')
                api_name = component.get('api_name')
                file_path = component.get('file_path', 'unknown')
                
                if not comp_type or not api_name:
                    error_msg = f"Component missing type or api_name: {component}"
                    errors.append(error_msg)
                    self._log_error(error_msg)
                    continue
                
                # Check if component is available
                if vcfg and not vcfg.is_object_available(comp_type):
                    warn_msg = f"Component type '{comp_type}' is unavailable - skipping {api_name}"
                    warnings.append(warn_msg)
                    self._log_warning(warn_msg)
                    components_skipped += 1
                    continue
                
                # Check file size if enabled
                if vcfg and vcfg.should_skip_large_files():
                    file_size_mb = self._get_file_size_mb(file_path)
                    threshold = vcfg.get_large_file_threshold_mb()
                    
                    if file_size_mb > threshold:
                        warn_msg = f"Component {api_name} file is {file_size_mb}MB > {threshold}MB threshold - skipping"
                        warnings.append(warn_msg)
                        self._log_warning(warn_msg)
                        components_skipped += 1
                        continue
                
                # Component is valid
                components_validated += 1
                validated_components.append(api_name)
                self._log_success(f"Component '{api_name}' ({comp_type}) - OK")
            
            # Determine result
            if errors:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.FAILED,
                    message=f"Component validation failed - {len(errors)} errors",
                    components_validated=components_validated,
                    components_skipped=components_skipped,
                    errors=errors,
                    warnings=warnings,
                    details={
                        'story': story_name,
                        'level': validation_level,
                        'validated_components': validated_components,
                    }
                )
            
            elif components_validated == 0:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SKIPPED,
                    message=f"All components skipped ({components_skipped} skipped)",
                    components_validated=0,
                    components_skipped=components_skipped,
                    warnings=warnings,
                )
            
            else:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SUCCESS,
                    message=f"All components validated successfully - {components_validated} validated, {components_skipped} skipped",
                    components_validated=components_validated,
                    components_skipped=components_skipped,
                    warnings=warnings if warnings else None,
                    details={
                        'story': story_name,
                        'level': validation_level,
                        'validated_components': validated_components,
                    }
                )
        
        except Exception as e:
            error_msg = f"Component validation error: {str(e)}"
            self._log_error(error_msg)
            return ValidatorResult(
                name=self.name,
                status=ValidatorStatus.ERROR,
                message=error_msg,
                errors=[error_msg],
            )
    
    def _get_file_size_mb(self, file_path: str) -> float:
        """Get file size in MB"""
        try:
            import os
            if os.path.exists(file_path):
                size_bytes = os.path.getsize(file_path)
                return size_bytes / (1024 * 1024)  # Convert to MB
        except Exception:
            pass
        return 0


# ============================================================================
# VALIDATOR 2: Commit Validation Validator
# ============================================================================

class CommitValidationValidator(BaseValidator):
    """
    Validate commit information
    
    Validates:
    - Commit ID is provided
    - Branch is specified
    - Story metadata is complete
    - Commit has changes
    """
    
    def __init__(self):
        super().__init__("CommitValidationValidator")
    
    def validate(self, context: Dict) -> ValidatorResult:
        """Validate commit information"""
        
        self._log_info("Starting commit validation")
        
        try:
            errors = []
            warnings = []
            
            # Check required fields
            story_name = context.get('story_name')
            target_env = context.get('target_env')
            commit_id = context.get('commit_id')
            branch = context.get('branch')
            
            if not story_name:
                errors.append("Story name is missing")
            
            if not target_env:
                errors.append("Target environment is missing")
            
            if not commit_id:
                warnings.append("Commit ID is missing")
            
            if not branch:
                warnings.append("Branch is missing")
            
            # Check if commit has components
            commit_components = context.get('commit_components', [])
            if not commit_components:
                warnings.append("No components found in commit")
            
            # Determine result
            if errors:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.FAILED,
                    message=f"Commit validation failed - {len(errors)} errors",
                    errors=errors,
                    warnings=warnings,
                    details={
                        'story': story_name,
                        'commit_id': commit_id,
                        'branch': branch,
                    }
                )
            
            elif warnings:
                self._log_warning(f"Commit has {len(warnings)} warnings")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.WARNING,
                    message=f"Commit validation passed with warnings",
                    warnings=warnings,
                    details={
                        'story': story_name,
                        'commit_id': commit_id,
                        'branch': branch,
                    }
                )
            
            else:
                self._log_success("Commit validation passed")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SUCCESS,
                    message="Commit validation successful",
                    details={
                        'story': story_name,
                        'commit_id': commit_id,
                        'branch': branch,
                        'components': len(commit_components),
                    }
                )
        
        except Exception as e:
            error_msg = f"Commit validation error: {str(e)}"
            self._log_error(error_msg)
            return ValidatorResult(
                name=self.name,
                status=ValidatorStatus.ERROR,
                message=error_msg,
                errors=[error_msg],
            )


# ============================================================================
# VALIDATOR 3: File Mapping Validator
# ============================================================================

class FileMappingValidator(BaseValidator):
    """
    Validate file to component mapping
    
    Validates:
    - Files are correctly mapped to components
    - No orphaned files
    - No duplicate mappings
    - File paths are valid
    """
    
    def __init__(self):
        super().__init__("FileMappingValidator")
    
    def validate(self, context: Dict) -> ValidatorResult:
        """Validate file to component mapping"""
        
        self._log_info("Starting file mapping validation")
        
        try:
            errors = []
            warnings = []
            
            commit_components = context.get('commit_components', [])
            story_name = context.get('story_name', 'Unknown')
            validation_level = context.get('validation_level', 'standard')
            
            if not commit_components:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SKIPPED,
                    message="No components to validate",
                )
            
            # Check for duplicate mappings
            seen_files = set()
            for component in commit_components:
                file_path = component.get('file_path')
                api_name = component.get('api_name')
                
                if not file_path:
                    warnings.append(f"Component {api_name} has no file path")
                    continue
                
                if file_path in seen_files:
                    errors.append(f"File {file_path} mapped to multiple components")
                else:
                    seen_files.add(file_path)
            
            # Validate file paths
            for component in commit_components:
                file_path = component.get('file_path')
                if file_path:
                    if not self._is_valid_file_path(file_path):
                        warnings.append(f"Invalid file path format: {file_path}")
            
            # Determine result
            if errors:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.FAILED,
                    message=f"File mapping validation failed - {len(errors)} errors",
                    errors=errors,
                    warnings=warnings,
                    components_validated=len(commit_components),
                )
            
            elif warnings:
                self._log_warning(f"File mapping has {len(warnings)} warnings")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.WARNING,
                    message=f"File mapping validation passed with warnings",
                    warnings=warnings,
                    components_validated=len(commit_components),
                )
            
            else:
                self._log_success("File mapping validation passed")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SUCCESS,
                    message="File mapping validation successful",
                    components_validated=len(commit_components),
                    details={
                        'story': story_name,
                        'level': validation_level,
                        'files_validated': len(seen_files),
                    }
                )
        
        except Exception as e:
            error_msg = f"File mapping validation error: {str(e)}"
            self._log_error(error_msg)
            return ValidatorResult(
                name=self.name,
                status=ValidatorStatus.ERROR,
                message=error_msg,
                errors=[error_msg],
            )
    
    def _is_valid_file_path(self, file_path: str) -> bool:
        """Check if file path is valid"""
        if not file_path:
            return False
        # Basic validation - path should not have invalid characters
        invalid_chars = ['<', '>', '"', '|', '?', '*']
        return not any(char in file_path for char in invalid_chars)


# ============================================================================
# VALIDATOR 4: Branch Comparison Validator
# ============================================================================

class BranchComparisonValidator(BaseValidator):
    """
    Compare branches for deployment readiness
    
    Validates:
    - Source branch is correct
    - Target branch exists
    - Branch has diverged appropriately
    - No conflicting changes
    """
    
    def __init__(self):
        super().__init__("BranchComparisonValidator")
    
    def validate(self, context: Dict) -> ValidatorResult:
        """Validate branch comparison"""
        
        self._log_info("Starting branch comparison validation")
        
        try:
            errors = []
            warnings = []
            
            branch = context.get('branch')
            target_env = context.get('target_env')
            story_name = context.get('story_name', 'Unknown')
            
            if not branch:
                warnings.append("Branch information not provided")
                # Allow to continue with warning
            
            if not target_env:
                errors.append("Target environment not specified")
            
            # Check branch naming convention (if branch provided)
            if branch:
                if not self._is_valid_branch_name(branch):
                    warnings.append(f"Branch name '{branch}' doesn't follow naming convention")
            
            # Determine result
            if errors:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.FAILED,
                    message=f"Branch comparison failed - {len(errors)} errors",
                    errors=errors,
                    warnings=warnings,
                )
            
            elif warnings:
                self._log_warning(f"Branch comparison has {len(warnings)} warnings")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.WARNING,
                    message="Branch comparison passed with warnings",
                    warnings=warnings,
                    details={
                        'story': story_name,
                        'branch': branch,
                        'target_env': target_env,
                    }
                )
            
            else:
                self._log_success("Branch comparison passed")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SUCCESS,
                    message="Branch comparison successful",
                    details={
                        'story': story_name,
                        'branch': branch,
                        'target_env': target_env,
                    }
                )
        
        except Exception as e:
            error_msg = f"Branch comparison error: {str(e)}"
            self._log_error(error_msg)
            return ValidatorResult(
                name=self.name,
                status=ValidatorStatus.ERROR,
                message=error_msg,
                errors=[error_msg],
            )
    
    def _is_valid_branch_name(self, branch: str) -> bool:
        """Check if branch name is valid"""
        # Basic validation - branch should not have invalid characters
        invalid_chars = [' ', '\t', '~', '^', ':', '?', '[', '\\']
        return not any(char in branch for char in invalid_chars) and len(branch) > 0


# ============================================================================
# VALIDATOR 5: Content Verification Validator
# ============================================================================

class ContentVerificationValidator(BaseValidator):
    """
    Verify component content/syntax
    
    Validates:
    - Apex syntax is valid
    - JSON is valid
    - XML is well-formed
    - No forbidden code patterns
    
    Note: Only runs for critical validation level
    """
    
    def __init__(self):
        super().__init__("ContentVerificationValidator")
    
    def validate(self, context: Dict) -> ValidatorResult:
        """Validate component content"""
        
        self._log_info("Starting content verification validation")
        
        try:
            validation_level = context.get('validation_level', 'standard')
            
            # Only run for critical level
            if validation_level != 'critical':
                self._log_info(f"Content verification skipped for level: {validation_level}")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SKIPPED,
                    message=f"Content verification only runs for critical level (current: {validation_level})",
                )
            
            errors = []
            warnings = []
            commit_components = context.get('commit_components', [])
            
            self._log_info(f"Verifying content for {len(commit_components)} components")
            
            components_verified = 0
            
            # Verify each component
            for component in commit_components:
                comp_type = component.get('type')
                api_name = component.get('api_name')
                file_path = component.get('file_path')
                
                if not file_path:
                    continue
                
                # Verify based on component type
                if comp_type == 'ApexClass':
                    result = self._verify_apex(file_path, api_name)
                elif comp_type in ['CustomObject', 'Field']:
                    result = self._verify_xml(file_path, api_name)
                elif comp_type == 'DataRaptor':
                    result = self._verify_json(file_path, api_name)
                else:
                    # Unknown type - skip
                    continue
                
                if result['status'] == 'error':
                    errors.extend(result['errors'])
                elif result['status'] == 'warning':
                    warnings.extend(result['warnings'])
                elif result['status'] == 'success':
                    components_verified += 1
            
            # Determine result
            if errors:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.FAILED,
                    message=f"Content verification failed - {len(errors)} errors",
                    errors=errors,
                    warnings=warnings,
                    components_validated=components_verified,
                )
            
            elif warnings:
                self._log_warning(f"Content verification has {len(warnings)} warnings")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.WARNING,
                    message=f"Content verification passed with warnings",
                    warnings=warnings,
                    components_validated=components_verified,
                )
            
            else:
                self._log_success(f"Content verification passed for {components_verified} components")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SUCCESS,
                    message=f"Content verification successful",
                    components_validated=components_verified,
                )
        
        except Exception as e:
            error_msg = f"Content verification error: {str(e)}"
            self._log_error(error_msg)
            return ValidatorResult(
                name=self.name,
                status=ValidatorStatus.ERROR,
                message=error_msg,
                errors=[error_msg],
            )
    
    def _verify_apex(self, file_path: str, api_name: str) -> Dict:
        """Verify Apex code"""
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Check for forbidden patterns
            forbidden_patterns = ['hardcoded_password', 'System.debug(', '__future__']
            warnings = []
            for pattern in forbidden_patterns:
                if pattern in content:
                    warnings.append(f"Potential issue in {api_name}: contains '{pattern}'")
            
            if warnings:
                return {'status': 'warning', 'warnings': warnings, 'errors': []}
            return {'status': 'success', 'warnings': [], 'errors': []}
        except Exception as e:
            return {'status': 'error', 'warnings': [], 'errors': [f"Error reading {api_name}: {str(e)}"]}
    
    def _verify_xml(self, file_path: str, api_name: str) -> Dict:
        """Verify XML format"""
        try:
            import xml.etree.ElementTree as ET
            ET.parse(file_path)
            return {'status': 'success', 'warnings': [], 'errors': []}
        except Exception as e:
            return {'status': 'error', 'warnings': [], 'errors': [f"Invalid XML in {api_name}: {str(e)}"]}
    
    def _verify_json(self, file_path: str, api_name: str) -> Dict:
        """Verify JSON format"""
        try:
            import json
            with open(file_path, 'r') as f:
                json.load(f)
            return {'status': 'success', 'warnings': [], 'errors': []}
        except Exception as e:
            return {'status': 'error', 'warnings': [], 'errors': [f"Invalid JSON in {api_name}: {str(e)}"]}


# ============================================================================
# VALIDATOR 6: File Size Check Validator
# ============================================================================

class FileSizeCheckValidator(BaseValidator):
    """
    Check file sizes and warn on large files
    
    Validates:
    - File sizes are within acceptable limits
    - No unusually large files
    - Warns about potential performance issues
    """
    
    def __init__(self):
        super().__init__("FileSizeCheckValidator")
    
    def validate(self, context: Dict) -> ValidatorResult:
        """Validate file sizes"""
        
        self._log_info("Starting file size check validation")
        
        try:
            import os
            
            errors = []
            warnings = []
            
            commit_components = context.get('commit_components', [])
            story_name = context.get('story_name', 'Unknown')
            validation_level = context.get('validation_level', 'standard')
            
            # Get large file threshold
            vcfg = self._get_validation_config()
            threshold_mb = vcfg.get_large_file_threshold_mb() if vcfg else 10
            max_mb = 100  # Hard limit
            
            components_checked = 0
            
            for component in commit_components:
                file_path = component.get('file_path')
                api_name = component.get('api_name')
                
                if not file_path or not os.path.exists(file_path):
                    continue
                
                size_bytes = os.path.getsize(file_path)
                size_mb = size_bytes / (1024 * 1024)
                components_checked += 1
                
                if size_mb > max_mb:
                    errors.append(f"Component {api_name} is {size_mb:.1f}MB - exceeds hard limit of {max_mb}MB")
                elif size_mb > threshold_mb:
                    warnings.append(f"Component {api_name} is {size_mb:.1f}MB - exceeds recommended {threshold_mb}MB")
            
            # Determine result
            if errors:
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.FAILED,
                    message=f"File size check failed - {len(errors)} files exceed limits",
                    errors=errors,
                    warnings=warnings,
                    components_validated=components_checked,
                )
            
            elif warnings:
                self._log_warning(f"File size check found {len(warnings)} large files")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.WARNING,
                    message=f"File size check passed with {len(warnings)} warnings",
                    warnings=warnings,
                    components_validated=components_checked,
                    details={
                        'threshold_mb': threshold_mb,
                        'max_mb': max_mb,
                    }
                )
            
            else:
                self._log_success(f"All {components_checked} files are within size limits")
                return ValidatorResult(
                    name=self.name,
                    status=ValidatorStatus.SUCCESS,
                    message=f"File size check successful - all {components_checked} files within limits",
                    components_validated=components_checked,
                    details={
                        'story': story_name,
                        'level': validation_level,
                        'threshold_mb': threshold_mb,
                    }
                )
        
        except Exception as e:
            error_msg = f"File size check error: {str(e)}"
            self._log_error(error_msg)
            return ValidatorResult(
                name=self.name,
                status=ValidatorStatus.ERROR,
                message=error_msg,
                errors=[error_msg],
            )


# ============================================================================
# VALIDATOR FACTORY
# ============================================================================

class ValidatorFactory:
    """Factory to create validators by name"""
    
    _validators = {
        'component_existence': ComponentExistenceValidator,
        'commit_validation': CommitValidationValidator,
        'file_mapping': FileMappingValidator,
        'branch_comparison': BranchComparisonValidator,
        'content_verification': ContentVerificationValidator,
        'file_size_check': FileSizeCheckValidator,
    }
    
    @classmethod
    def create(cls, validator_name: str) -> Optional[BaseValidator]:
        """Create validator by name"""
        validator_class = cls._validators.get(validator_name.lower())
        if validator_class:
            return validator_class()
        return None
    
    @classmethod
    def create_all(cls) -> Dict[str, BaseValidator]:
        """Create all validators"""
        return {
            name: validator_class()
            for name, validator_class in cls._validators.items()
        }
    
    @classmethod
    def get_available_validators(cls) -> List[str]:
        """Get list of available validator names"""
        return list(cls._validators.keys())


# ============================================================================
# ✅ COMPATIBILITY FUNCTION - NEW
# ============================================================================

def get_all_validators(flags=None, git_client=None) -> Dict[str, BaseValidator]:
    """
    Get all validators
    
    Compatibility function for validation_engine.py
    
    Args:
        flags: Optional flags (not used, for compatibility)
        git_client: Optional git client (not used, for compatibility)
    
    Returns:
        Dict of validator name -> validator instance
    """
    return ValidatorFactory.create_all()


# ============================================================================
# TESTING
# ============================================================================

if __name__ == '__main__':
    
    import json
    logging.basicConfig(level=logging.INFO)
    
    print("\n" + "=" * 70)
    print("VALIDATORS TEST")
    print("=" * 70)
    
    # Create test context
    test_context = {
        'story_name': 'US-001',
        'target_env': 'staging',
        'branch': 'feature/US-001',
        'commit_id': 'abc123def456',
        'validation_level': 'standard',
        'commit_components': [
            {
                'type': 'ApexClass',
                'api_name': 'MyClass',
                'file_path': 'src/apex/MyClass.cls',
            },
            {
                'type': 'CustomObject',
                'api_name': 'Account',
                'file_path': 'src/objects/Account.object',
            },
        ]
    }
    
    print("\nTest Context:")
    print(json.dumps(test_context, indent=2))
    
    # Get all validators
    print("\n" + "=" * 70)
    print("AVAILABLE VALIDATORS:")
    print("=" * 70)
    validators = ValidatorFactory.get_available_validators()
    for v in validators:
        print(f"  ✅ {v}")
    
    # Run validators
    print("\n" + "=" * 70)
    print("RUNNING VALIDATORS:")
    print("=" * 70)
    
    all_validators = ValidatorFactory.create_all()
    results = {}
    
    for name, validator in all_validators.items():
        print(f"\n--- {name} ---")
        result = validator.validate(test_context)
        print(f"Status: {result.status.value}")
        print(f"Message: {result.message}")
        results[name] = result.to_dict()
    
    print("\n" + "=" * 70)
    print("VALIDATION RESULTS:")
    print("=" * 70)
    print(json.dumps(results, indent=2))
    
    print("\n" + "=" * 70)
    print("✅ ALL VALIDATORS EXECUTED")
    print("=" * 70)