# integration_test.py
"""
Test the specific integration points your existing app will use
"""
from deployment_prover import DeploymentProver

# Test the exact methods your app will call
prover = DeploymentProver(mock_mode=True)

# 1. Single story deployment
result1 = prover.prove_story_deployment("US-0033960", "QASales")

# 2. Multiple stories
result2 = prover.prove_deployment(["US-0033960", "US-0033961"], "QASales")

# 3. Release deployment  
result3 = prover.prove_release_deployment("R2024-10", "UAT")

print("✅ All integration points work")
print(f"Single story: {result1['overall_proof']['verdict']}")
print(f"Multiple stories: {result2['overall_proof']['verdict']}") 
print(f"Release: {result3['overall_proof']['verdict']}")