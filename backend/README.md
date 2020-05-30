## Deploying WebSocket API in API Gateway to process the question and answer messages

Build a 1) WebSockets API in AWS API Gateway, 2) create lambda functions to manage WebSockets routes ($connect, $disconnect, sendMessage) and 3) create DynamoDb to store WebSockets connectionIds and user name.

### Setup SSM parameters

Copy Cognito app client id and user pool id to following SSM parameters:

- /chatbot/dev/app_client_id
- /chatbot/dev/user_pool_id

### Deploy Serverless Project

```
$sls deploy
```
