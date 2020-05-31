import json
import logging
import boto3
import datetime
import websocket
import ssl
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)
ssm = boto3.client('ssm', region_name="ap-southeast-2")
KENDRA_INDEX_SSM = ssm.get_parameter(Name=os.environ["KENDRA_INDEX_KEY"])
kendra_index_id = KENDRA_INDEX_SSM["Parameter"]["Value"]
kendra = boto3.client('kendra', region_name='us-east-1')
ROBOT_USER_SSM = ssm.get_parameter(Name=os.environ["ROBOT_USER_SSM"])
user_name = ROBOT_USER_SSM["Parameter"]["Value"]
ROBOT_PASS_SSM = ssm.get_parameter(
    Name=os.environ["ROBOT_PASS_SSM"], WithDecryption=True)
password = ROBOT_PASS_SSM["Parameter"]["Value"]
USER_POOL_SSM = ssm.get_parameter(Name=os.environ["USER_POOL_SSM"])
user_pool = USER_POOL_SSM["Parameter"]["Value"]
APP_CLIENT_SSM = ssm.get_parameter(Name=os.environ["APP_CLIENT_SSM"])
app_client = APP_CLIENT_SSM["Parameter"]["Value"]
credentials = boto3.Session().get_credentials()
WS_URL_SSM = ssm.get_parameter(Name=os.environ["WS_URL_KEY"])


def on_message(ws, message):
    message_obj = json.loads(message)
    result = get_answer(message_obj["data"]["text"])
    if len(result["ResultItems"]) > 0:
        logger.debug(result["ResultItems"][0]["DocumentExcerpt"]["Text"])
        answer_text = result["ResultItems"][0]["DocumentExcerpt"]["Text"]
    else:
        answer_text = "Sorry, I could not find an answer."

    ws.send(json.dumps({
            "action": "sendMessage",
            "data": json.dumps({"data": answer_text,
                                "type": "text",
                                "author": "ROBOT",
                                "to": message_obj["author"]})
            }))


def authenticate_and_get_token(username, password,
                               user_pool_id, app_client_id):
    client = boto3.client('cognito-idp')

    resp = client.admin_initiate_auth(
        UserPoolId=user_pool_id,
        ClientId=app_client_id,
        AuthFlow='ADMIN_NO_SRP_AUTH',
        AuthParameters={
            "USERNAME": username,
            "PASSWORD": password
        }
    )

    return resp['AuthenticationResult']['AccessToken']


def on_error(ws, error):
    logger.error(error)


def on_close(ws):
    logger.info("### closed ###")


def on_open(ws):
    logger.info("connected")


def get_answer(text):
    response = kendra.query(
        IndexId=kendra_index_id,
        QueryText=text,
        QueryResultTypeFilter='QUESTION_ANSWER',
    )
    return response


if __name__ == '__main__':
    access_token = authenticate_and_get_token(
        user_name, password, user_pool, app_client)

    ws_url = "{}?token={}&username=ROBOT".format(
        WS_URL_SSM["Parameter"]["Value"], access_token)
    websocket.enableTrace(False)
    ws = websocket.WebSocketApp(ws_url, on_message=on_message,
                                on_error=on_error,
                                on_close=on_close)
    ws.on_open = on_open
    ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
