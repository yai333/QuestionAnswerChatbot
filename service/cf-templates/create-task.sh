#!/bin/bash

set -ex

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -d|--deploy) deploy="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

AWS_PROFILE=$(jq -r '.AWS_PROFILE' params.json)
STACK_NAME_PREFIX=$(jq -r '.INFRA_STACK_NAME_PREFIX' params.json)
AWS_DEFAULT_REGION=$(jq -r '.DEFAULT_REGION' params.json)
SERVICE_STACK_NAME_PREFIX=$(jq -r '.SERVICE_STACK_NAME_PREFIX' params.json)
PARENT_STACK_NAME="$STACK_NAME_PREFIX-$deploy"
SERVICE_STACK_NAME="$SERVICE_STACK_NAME_PREFIX-$deploy"



cluster_stack_output=$(aws --profile "${AWS_PROFILE}" --region "${AWS_DEFAULT_REGION}" \
    cloudformation describe-stacks --stack-name "$PARENT_STACK_NAME" \
    | jq '.Stacks[].Outputs[]')

cluster_name=($(echo $cluster_stack_output \
    | jq -r 'select(.OutputKey == "Cluster") | .OutputValue'))

task_role_arn=($(echo $cluster_stack_output \
    | jq -r 'select(.OutputKey == "TaskIamRoleArn") | .OutputValue'))

execution_role_arn=($(echo $cluster_stack_output \
    | jq -r 'select(.OutputKey == "TaskExecutionIamRoleArn") | .OutputValue'))

ecs_service_log_group=($(echo $cluster_stack_output \
    | jq -r 'select(.OutputKey == "ECSServiceLogGroup") | .OutputValue'))

env_s3_bucket=($(echo $cluster_stack_output \
    | jq -r 'select(.OutputKey == "EnvVariblesS3") | .OutputValue'))

 
envoy_log_level="debug"

IMAGE="$( aws ecr describe-repositories --repository-name chatbot \
             --region ${AWS_DEFAULT_REGION} --profile ${AWS_PROFILE} \
             --query 'repositories[0].repositoryUri' --output text)"

task_def_json=$(jq -n \
    --arg IMAGE $IMAGE \
    --arg SERVICE_LOG_GROUP $ecs_service_log_group \
    --arg WS_URL_KEY "/chatbot/$deploy/ws_url" \
    --arg KENDRA_INDEX_KEY "/chatbot/$deploy/kendra_index_id" \
    --arg ROBOT_PASS_SSM "/chatbot/$deploy/robot_passowrd" \
    --arg ROBOT_USER_SSM "/chatbot/$deploy/robot_user_name" \
    --arg USER_POOL_SSM "/chatbot/$deploy/user_pool_id" \
    --arg APP_CLIENT_SSM "/chatbot/$deploy/app_client_id" \
    --arg TASK_ROLE_ARN $task_role_arn \
    --arg PROJECT_NAME "chatbot-worker-$deploy" \
    --arg EXECUTION_ROLE_ARN $execution_role_arn \
    -f "${DIR}/task-definition.json")

task_def_arn=$(aws --profile "${AWS_PROFILE}" --region "${AWS_DEFAULT_REGION}" \
    ecs register-task-definition \
    --cli-input-json "${task_def_json}" \
    --query [taskDefinition.taskDefinitionArn] --output text)


ecs_service=$(aws --profile "${AWS_PROFILE}" --region "${AWS_DEFAULT_REGION}" \
    ecs describe-services --services "$SERVICE_STACK_NAME" --cluster "$cluster_name" --output text || echo "NONE")


if [ "$ecs_service" != "NONE" ]
then
    aws ecs update-service  --profile "${AWS_PROFILE}" --region "${AWS_DEFAULT_REGION}" \
                            --cluster ${cluster_name} \
                            --service $SERVICE_STACK_NAME \
                            --task-definition "${task_def_arn}" \
                            --desired-count 1
fi
 

