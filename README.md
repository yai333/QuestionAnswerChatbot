# Introduction

This repo provides a proof of concept of question and answer chatbot solution. The chatbot uses React with Amplify, AWS API Gateway WebSocket API, AWS Fargate and Amazon Kendra to provide a conversational interface for your "Questions and Answers." This allows your users to ask their questions and get quick and relevant answers.

## Dataset download and transform

[chatbot.ipynb](chatbot.ipynb)

## Frontend

Frontend React application is in `./frontend` dir. [README](frontend/README.md)

## Backend

Serverless project of AWS Websocket API is in `./backend` dir. [README](backend/README.md)

## AWS Fargateway Service

Cloudformation templates and scripts are in `./service` dir. [README](service/README.md)
