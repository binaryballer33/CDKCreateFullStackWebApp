#!/usr/bin/env node
import 'source-map-support/register';
import {App} from "@aws-cdk/core";
import {CDKFullStackWebAppStack} from '../lib/cdkFullStackWebAppStack';

const stack = new CDKFullStackWebAppStack(new App(), 'CreateWebsiteStack', {
    stackName: 'CreateWebsiteStack',
    // these env var get auto created when you run cdk synth or cdk deploy, use aws configure to set them up
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});

// creates s3 bucket and deploys the source code to the bucket, you can't use https with this method
// stack.initializeS3StaticWebsite({
//     websiteSourceCodeLocation: "source_yourWebsite", // location of the website source code
//     websiteIndexDocument: 'index.html', // index document of the website
//     domainName: "example.com",   // domain name of the website, but for this method it will be the name of the bucket
// })

// creates cloudfront distribution so that you can host a https website, you receive a random cloudfront domain name
// stack.initializeCloudFrontWebsite({
//     websiteIndexDocument: 'index.html',
//     websiteErrorDocument: 'error.html', // error document of the website, defaults to index.html if not provided
//     websiteSourceCodeLocation: "source_yourWebsite",
//     domainName: "example.com",
//     subdomain: "www" // subdomain of the website, defaults to www if not provided
// })

// creates cloudfront distribution with a custom domain name, read README.md for more info
stack.initializeCloudFrontWebsiteWithCustomDomainName({
    websiteIndexDocument: 'index.html',
    websiteErrorDocument: 'error.html',
    websiteSourceCodeLocation: "source_yourWebsite",
    domainName: "example.com",
})
