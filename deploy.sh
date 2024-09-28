#!/bin/bash
cd "./twinge-service"
serverless deploy
cd "../twinge-client"
npm run build
aws s3 sync "./dist" "s3://twinge-client"
cd ..
aws cloudfront create-invalidation --distribution-id="ERFLEM1FN5M32" --paths="/*"