#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
ENV_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../../frontend" >/dev/null && pwd )"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -d|--deploy) deploy="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

PROFILE=$(jq -r '.AWS_PROFILE' params.json)
STACK_NAME_PREFIX=$(jq -r '.INFRA_STACK_NAME_PREFIX' params.json)
DEFAULT_REGION=$(jq -r '.DEFAULT_REGION' params.json)
STACK_NAME="$STACK_NAME_PREFIX-$deploy"

aws cloudformation deploy \
    --stack-name "${STACK_NAME}" \
    --template-file "${DIR}/infra.yaml" \
    --region ap-southeast-2 \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
    EnvironmentName="${deploy}"  \
    ECSAMI="/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id"

    
cluster_stack_output=$(aws --profile "${PROFILE}" --region "${DEFAULT_REGION}" \
    cloudformation describe-stacks --stack-name "$STACK_NAME" \
    | jq '.Stacks[].Outputs[]')

 