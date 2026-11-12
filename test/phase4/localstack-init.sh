#!/bin/sh
set -eu
for name in os-events billing-commands production-commands; do
  dlq=$(awslocal sqs create-queue --queue-name "$name-dlq" --query QueueUrl --output text)
  arn=$(awslocal sqs get-queue-attributes --queue-url "$dlq" --attribute-names QueueArn --query Attributes.QueueArn --output text)
  awslocal sqs create-queue --queue-name "$name" --attributes "{\"VisibilityTimeout\":\"60\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$arn\\\",\\\"maxReceiveCount\\\":3}\"}"
done
if ! awslocal dynamodb describe-table --table-name oficina-production >/dev/null 2>&1; then
  awslocal dynamodb create-table --table-name oficina-production \
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=gsi1pk,AttributeType=S AttributeName=gsi1sk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes '[{"IndexName":"pending-index","KeySchema":[{"AttributeName":"gsi1pk","KeyType":"HASH"},{"AttributeName":"gsi1sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'
fi
touch /tmp/phase4-ready
