# example_usage.py

from config import get_config
from validation_config import get_validation_config
from validation_flags import resolve_validation_flags

def main():
    # Load all configuration
    cfg = get_config()
    vcfg = get_validation_config()
    
    print("=" * 60)
    print("CONFIGURATION LOADED")
    print("=" * 60)
    
    # Show BitBucket config
    print("\n📦 BitBucket Configuration:")
    print(f"  API Workers: {cfg.API_MAX_WORKERS}")
    print(f"  BitBucket Workers: {cfg.BITBUCKET_MAX_WORKERS}")
    print(f"  Timeout: {cfg.BITBUCKET_TIMEOUT}s")
    
    # Show Validation config
    print("\n✅ Validation Configuration:")
    print(f"  Enabled: {vcfg.is_enabled()}")
    print(f"  Default Level: {vcfg.get_validation_level()}")
    print(f"  Large File Threshold: {vcfg.get_large_file_threshold_mb()}MB")
    print(f"  Skip Large Files: {vcfg.should_skip_large_files()}")
    print(f"  Unavailable Objects: {vcfg.get_unavailable_objects()}")
    
    # Show validators for each level
    print("\n🔍 Validators per Level:")
    for level in ['fast', 'standard', 'full', 'critical']:
        validators = vcfg.get_enabled_validators(level)
        print(f"  {level}: {validators}")
    
    # Resolve flags for a story
    print("\n📝 Story Validation Flags:")
    story_metadata = {
        'story_name': 'US-001',
        'is_critical': False,
        'is_hotfix': False,
    }
    flags = resolve_validation_flags(cfg, story_metadata)
    print(f"  Level: {flags['validation_level']}")
    print(f"  Validators: {flags['validators']}")
    print(f"  Skip Large Files: {flags['skip_large_files']}")
    
    print("\n" + "=" * 60)
    print("✅ ALL SYSTEMS READY")
    print("=" * 60)

if __name__ == '__main__':
    main()