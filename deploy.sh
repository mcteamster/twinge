#!/bin/bash
cd "./twinge-service"
serverless deploy
cd "../twinge-client"
npm run build
aws s3 sync "./build" "s3://twinge-service-dev-s3bucket-he3pcrohpp9p"