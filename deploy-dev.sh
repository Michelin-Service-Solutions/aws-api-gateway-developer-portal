sam deploy --template-file ./cloudformation/packaged.yaml \
    --stack-name "developer-portal-dev" \
    --s3-bucket misp-developer-portal-dev \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile dsp-development \
    --parameter-overrides \
    DevPortalSiteS3BucketName="michelin-dev-portal-static-assets" \
    ArtifactsS3BucketName="michelin-dev-portal-artifacts" \
    CognitoDomainNameOrPrefix="michelin-dev" \
    CustomDomainName="developers.integration.misp-solutions.com" \
    CustomDomainNameAcmCertArn="arn:aws:acm:us-east-1:540573004174:certificate/8aa9a205-cc3b-4558-9df9-a25175e80280" \
    UseRoute53Nameservers="false"