FROM python:3.6.7-slim
RUN apt-get update && apt-get -y install python3-dev libffi-dev gcc musl-dev make
RUN mkdir /app
WORKDIR /app
COPY requirements.txt /app/requirements.txt
COPY robot.py /app/robot.py
RUN pip install -r /app/requirements.txt
EXPOSE 443
CMD ["python3", "/app/robot.py"]