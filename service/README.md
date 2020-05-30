## Creating a bot service in AWS Fargate

Build Docker, Tag an Amazon ECR Repository and push the image to ECR, for more details, please refer to [AWS official tutorial](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html).

```
$docker build . -t XXXXX.dkr.ecr.XXXXXX.amazonaws.com/chatbot
```

Login to ECR

```
$eval $(aws ecr get-login --region YOUR_REGION --no-include-email)
```

Push image to ECR:

```
$docker push XXXXX.dkr.ecr.XXXXXX.amazonaws.com/chatbot
```

Deploy VPC and Security Groups for chatbot service.

```
$bash create-infra.sh -d dev
```

Create task definition.

```
$bash create-task.sh -d dev
```

Deploy chatbot service in AWS Fargate.

```
$bash deploy-service.sh -d dev
```
