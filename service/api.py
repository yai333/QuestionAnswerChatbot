import json
import logging
import boto3
import flask
import torch
import datetime
import torch.nn.functional as F
# from requests_aws4auth import AWS4Auth
from simpletransformers.conv_ai import ConvAIModel
from flask import request, Response

app = flask.Flask(__name__)
region = 'ap-southeast-2'
# ssm = boto3.client('ssm', region_name=region)
# credentials = boto3.Session().get_credentials()
# awsauth = AWS4Auth(credentials.access_key, credentials.secret_key,
#                    region, service, session_token=credentials.token)
dynamodb = boto3.client('dynamodb')
polly_client = boto3.Session(region_name=region).client('polly')
s3 = boto3.resource('s3')
BUCKET_NAME = "aiyi.demo.textract"
TABLE_NAME = "serverless-chat-dev-ChatHistoryTable-M0BPSVMQJBFX"
SPECIAL_TOKENS = ["<bos>", "<eos>", "<speaker1>", "<speaker2>", "<pad>"]
history = []
convAimodel = ConvAIModel("gpt", "model", use_cuda=False)
character = [
    "i like computers .",
    "i like reading books .",
    "i like talking to chatbots .",
    "i love listening to classical music ."
]


def text_2_speech(userid, response_msg):
    response = polly_client.synthesize_speech(VoiceId='Joanna',
                                              OutputFormat='mp3',
                                              Text=response_msg)
    object_key = "{}/{}/speech.mp3".format(userid,
                                           int(datetime.datetime.utcnow().timestamp()))
    object = s3.Object(
        BUCKET_NAME, object_key)
    object.put(Body=response['AudioStream'].read())
    return object_key


def get_chat_histories(userid):
    response = dynamodb.get_item(TableName=TABLE_NAME, Key={
        'userid': {
            'S': userid
        }})

    if 'Item' in response:
        return json.loads(response["Item"]["history"]["S"])
    return {"history": []}


def save_chat_histories(userid, history):
    return dynamodb.put_item(TableName=TABLE_NAME, Item={'userid': {'S': userid}, 'history': {'S': history}})


def sample_sequence(aiCls, personality, history, tokenizer, model, args, current_output=None):
    special_tokens_ids = tokenizer.convert_tokens_to_ids(SPECIAL_TOKENS)
    if current_output is None:
        current_output = []

    for i in range(args["max_length"]):
        instance = aiCls.build_input_from_segments(
            personality, history, current_output, tokenizer, with_eos=False)

        input_ids = torch.tensor(
            instance["input_ids"], device=aiCls.device).unsqueeze(0)
        token_type_ids = torch.tensor(
            instance["token_type_ids"], device=aiCls.device).unsqueeze(0)

        logits = model(input_ids, token_type_ids=token_type_ids)
        if isinstance(logits, tuple):  # for gpt2 and maybe others
            logits = logits[0]
        logits = logits[0, -1, :] / args["temperature"]
        logits = aiCls.top_filtering(
            logits, top_k=args["top_k"], top_p=args["top_p"])
        probs = F.softmax(logits, dim=-1)

        prev = torch.topk(probs, 1)[
            1] if args["no_sample"] else torch.multinomial(probs, 1)
        if i < args["min_length"] and prev.item() in special_tokens_ids:
            while prev.item() in special_tokens_ids:
                if probs.max().item() == 1:
                    warnings.warn(
                        "Warning: model generating special token with probability 1.")
                    break  # avoid infinitely looping over special token
                prev = torch.multinomial(probs, num_samples=1)

        if prev.item() in special_tokens_ids:
            break
        current_output.append(prev.item())

    return current_output


def interact(raw_text, model, personality, userid, history):
    """
    Interact with a model in the terminal.
    Args:
        personality: A list of sentences that the model will use to build a personality.
    Returns:
        None
    """
    args = model.args
    tokenizer = model.tokenizer
    process_count = model.args["process_count"]

    model._move_model_to_device()

    if not personality:
        dataset = get_dataset(
            tokenizer,
            None,
            args["cache_dir"],
            process_count=process_count,
            proxies=model.__dict__.get("proxies", None),
            interact=True,
        )
        personalities = [dialog["personality"]
                         for dataset in dataset.values() for dialog in dataset]
        personality = random.choice(personalities)
    else:
        personality = [tokenizer.encode(s.lower()) for s in personality]

    history.append(tokenizer.encode(raw_text))
    with torch.no_grad():
        out_ids = sample_sequence(
            model, personality, history, tokenizer, model.model, args)
    history.append(out_ids)
    history = history[-(2 * args["max_history"] + 1):]
    out_text = tokenizer.decode(out_ids, skip_special_tokens=True)
    save_chat_histories(userid, json.dumps({"history": history}))
    return out_text


@app.route('/message-received', methods=['POST'])
def process_chat_message():
    response = None

    if request.form['userid'] is None:
        response = Response("", status=415)
    else:
        try:
            userid = request.form['userid']
            message = request.form['message']
            history = get_chat_histories(userid)
            history = history["history"]
            response_msg = interact(message, convAimodel,
                                    character, userid, history)
            audio_key = text_2_speech(userid, response_msg)
            return Response(
                json.dumps({"message": response_msg, "audio": audio_key}),
                status=200, mimetype='application/json')
        except Exception as ex:
            logging.exception(ex)
            return Response(ex.message, status=500)
    # return response


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)


# @app.route('/message-received', methods=['POST'])
# def process_chat_message():
#     response = None
#     interact("hello", convAimodel, [
#         "i like to remodel homes .",
#         "i like to go hunting .",
#         "i like to shoot a bow .",
#         "my favorite holiday is halloween ."
#     ])
#     if request.json is None:
#     response = Response("", status=415)
#     else:
#         message = dict()
#         try:
#             if request.json.has_key('TopicArn') and request.json.has_key('Message'):
#                 message = json.loads(request.json['Message'])
#             else:
#                 message = request.json
#
#             response = Response("", status=200)
#         except Exception as ex:
#             logging.exception('Error processing message: %s' % request.json)
#             response = Response(ex.message, status=500)
#
#     return Response("", status=200)
#     # return response
