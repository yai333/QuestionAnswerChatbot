#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -d|--deploy) deploy="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

REGION=$(jq -r '.DEFAULT_REGION' params.json)
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
AWS_PROFILE=$(jq -r '.AWS_PROFILE' params.json)

task_api_arn=$(aws ecs list-task-definitions --family-prefix chatbot-worker-$deploy \
            --region ${REGION} --profile ${AWS_PROFILE} \
            --sort DESC \
            --query '[taskDefinitionArns[0]]' --output text)
 
aws cloudformation deploy \
    --stack-name "chatbot-service-$deploy" \
    --template-file "${DIR}/service.yaml" \
    --region ${REGION} \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
    StackName="chatbot-$deploy" \
    TaskDefinition="$task_api_arn" \
    EnvironmentName=$deploy \
    ServiceName="chatbot-service-$deploy"

    
