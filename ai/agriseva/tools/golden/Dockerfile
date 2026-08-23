FROM python:3.12-slim

WORKDIR /app/agriseva/tools/golden

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY agriseva/tools/golden/requirements.txt /app/agriseva/tools/golden/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY agriseva/tools/golden /app/agriseva/tools/golden

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/agriseva/tools/golden

EXPOSE 8005

CMD ["uvicorn", "golden_api:app", "--host", "0.0.0.0", "--port", "8005"]
