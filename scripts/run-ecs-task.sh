#!/bin/sh

aws ecs run-task \
  --cluster blockbuster-index-dev \
  --task-definition blockbuster-index-task-dev \
  --launch-type FARGATE \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-02ce757a,subnet-2655df7b,subnet-e22085a8,subnet-badfdd91],securityGroups=[sg-09812900f87093af6],assignPublicIp=ENABLED}' 