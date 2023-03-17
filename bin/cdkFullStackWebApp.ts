#!/usr/bin/env node
import 'source-map-support/register';
import {App} from "@aws-cdk/core";
import {CDKFullStackWebAppStack} from '../lib/cdkFullStackWebAppStack';

const stack = new CDKFullStackWebAppStack(new App(), 'CreateWebsiteStack', {
    stackName: 'CreateWebsiteStack',
    // these env var get auto created when you run cdk synth or cdk deploy, use aws configure to set them up
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});

// stack.initializeS3StaticWebsite({
//     websiteSourceCodeLocation: "sourceCodePathLocation", // location of the website source code
//     websiteIndexDocument: 'index.html', // index document of the website
//     websiteErrorDocument: 'index.html', // error document of the website, defaults to index.html if not provided
//     domainName: "example.com",   // domain name of the website, but for this method it will be the name of the bucket
// })

// stack.initializeCloudFrontWebsite({
//     websiteIndexDocument: 'index.html',
//     websiteSourceCodeLocation: "sourceCodePathLocation",
//     domainName: "example.com",
// })

// creates a www.example.com subdomain for the domain name that you enter
stack.initializeCloudFrontWebsiteWithCustomDomainName({
    websiteIndexDocument: 'index.html',
    websiteSourceCodeLocation: "source_mandytec",
    domainName: "shaquillemandy.com",  // domain name of the website and name of the s3 bucket
})

// TODO check if it now deletes A record and CNAME record and the bucket after adding the removal policy
