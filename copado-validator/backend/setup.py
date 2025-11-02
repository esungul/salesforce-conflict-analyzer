import os
import json

# Set your Salesforce credentials as environment variables
os.environ['SF_USERNAME'] = 'sunny.gulati@cwc.com'
os.environ['SF_PASSWORD'] = 'Haribool@143' 
os.environ['SF_SECURITY_TOKEN'] = 'rqGvy8PFC4MupuWCcB816AxD'
# Optional: Use 'test' for sandbox, 'login' for production
os.environ['SF_DOMAIN'] = 'login'

print("✅ Environment variables set for Salesforce authentication")

