"use strict";

const AWS = require("aws-sdk");
const DDB = new AWS.DynamoDB({ apiVersion: "2012-10-08" });
const jose = require("node-jose");
const fetch = require("node-fetch");
const KEYS_URL = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`;
const successfullResponse = {
  statusCode: 200,
  body: "Connected",
};

module.exports.connectionManager = async (event, context, callback) => {
  if (event.requestContext.eventType === "CONNECT") {
    try {
      await addConnection(
        event.requestContext.connectionId,
        event.queryStringParameters.username
      );
      callback(null, successfullResponse);
    } catch (error) {
      callback(null, JSON.stringify(error));
    }
  } else if (event.requestContext.eventType === "DISCONNECT") {
    try {
      await deleteConnection(event.requestContext.connectionId);
      callback(null, successfullResponse);
    } catch (error) {
      callback(null, {
        statusCode: 500,
        body: "Failed to connect: " + JSON.stringify(err),
      });
    }
  }
};

module.exports.defaultMessage = (event, context, callback) => {
  callback(null);
};

module.exports.sendMessage = async (event, context, callback) => {
  let connectionData;
  try {
    const { body } = event;
    const messageBodyObj = JSON.parse(body);
    const params = {
      IndexName: "userid_index",
      KeyConditionExpression: "userid = :u",
      ExpressionAttributeValues: {
        ":u": {
          S: JSON.parse(messageBodyObj.data).to || "ROBOT",
        },
      },
      TableName: process.env.CHATCONNECTION_TABLE,
    };
    connectionData = await DDB.query(params).promise();
  } catch (err) {
    console.log(err);
    return { statusCode: 500 };
  }
  const postCalls = connectionData.Items.map(async ({ connectionId }) => {
    try {
      return await send(event, connectionId.S);
    } catch (err) {
      if (err.statusCode === 410) {
        return await deleteConnection(connectionId.S);
      }
      console.log(JSON.stringify(err));
      throw err;
    }
  });

  try {
    await Promise.all(postCalls);
  } catch (err) {
    console.log(err);
    callback(null, JSON.stringify(err));
  }
  callback(null, successfullResponse);
};

const send = (event, connectionId) => {
  const postData = JSON.parse(event.body).data;
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });
  return apigwManagementApi
    .postToConnection({ ConnectionId: connectionId, Data: postData })
    .promise();
};

const addConnection = (connectionId, userid) => {
  const putParams = {
    TableName: process.env.CHATCONNECTION_TABLE,
    Item: {
      connectionId: { S: connectionId },
      userid: { S: userid },
    },
  };

  return DDB.putItem(putParams).promise();
};

const deleteConnection = (connectionId) => {
  const deleteParams = {
    TableName: process.env.CHATCONNECTION_TABLE,
    Key: {
      connectionId: { S: connectionId },
    },
  };

  return DDB.deleteItem(deleteParams).promise();
};

module.exports.authFunc = async (event, context, callback) => {
  const {
    queryStringParameters: { token },
    methodArn,
  } = event;

  let policy;

  try {
    policy = await authCognitoToken(token, methodArn);
    callback(null, policy);
  } catch (error) {
    console.log(error);
    callback("Signature verification failed");
  }
};

const authCognitoToken = async (token, methodArn) => {
  if (!token) throw new Error("Unauthorized");
  const app_client_id = process.env.APP_CLIENT_ID;
  const sections = token.split(".");
  let authHeader = jose.util.base64url.decode(sections[0]);
  authHeader = JSON.parse(authHeader);
  const kid = authHeader.kid;
  const rawRes = await fetch(KEYS_URL);
  const response = await rawRes.json();
  if (rawRes.ok) {
    const keys = response["keys"];
    let key_index = -1;
    keys.some((key, index) => {
      if (kid == key.kid) {
        key_index = index;
      }
    });
    const foundKey = keys.find((key) => {
      return kid === key.kid;
    });

    if (!foundKey) {
      callback("Public key not found in jwks.json");
    }

    const jwkRes = await jose.JWK.asKey(foundKey);
    const verifyRes = await jose.JWS.createVerify(jwkRes).verify(token);
    const claims = JSON.parse(verifyRes.payload);

    const current_ts = Math.floor(new Date() / 1000);
    if (current_ts > claims.exp) {
      throw new Error("Token is expired");
    }

    if (claims.client_id != app_client_id) {
      throw new Error("Token was not issued for this audience");
    } else {
      return generatePolicy("me", "Allow", methodArn);
    }
  }
  throw new Error("Keys url is invalid");
};

const generatePolicy = function (principalId, effect, resource) {
  var authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    var policyDocument = {};
    policyDocument.Version = "2012-10-17";
    policyDocument.Statement = [];
    var statementOne = {};
    statementOne.Action = "execute-api:Invoke";
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  return authResponse;
};

const generateAllow = function (principalId, resource) {
  return generatePolicy(principalId, "Allow", resource);
};

const generateDeny = function (principalId, resource) {
  return generatePolicy(principalId, "Deny", resource);
};
