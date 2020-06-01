# Introduction

This repo provides a proof of concept of question and answer chatbot solution. The chatbot uses React with Amplify, AWS API Gateway WebSocket API, AWS Fargate and Amazon Kendra to provide a conversational interface for your "Questions and Answers." This allows your users to ask their questions and get quick and relevant answers.

For more details, please refer to below link
https://towardsdatascience.com/create-a-question-and-answer-bot-with-amazon-kendra-and-aws-fargate-79c537d68e45

## Dataset download and transform

[chatbot.ipynb](chatbot.ipynb)

## Frontend layer

Frontend React application is in `./frontend` dir. [README](frontend/README.md)

## Backend layer

Serverless project of AWS Websocket API is in `./backend` dir. [README](backend/README.md)

## AWS Fargateway Service layer

Cloudformation templates and scripts are in `./service` dir. [README](service/README.md)
