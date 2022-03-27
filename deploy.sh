#!/bin/bash
cd "./twinge-service"
serverless deploy
cd "../twinge-client"
npm run build
aws s3 sync "./build" "s3://twinge-client"
cd ..
