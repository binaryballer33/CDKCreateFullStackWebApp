#!/usr/bin/env node
import 'source-map-support/register';
import {App} from "@aws-cdk/core";
import {CDKFullStackWebAppStack} from '../lib/cdkFullStackWebAppStack';

const app = new App();

new CDKFullStackWebAppStack(app, 'CloudFront-CustomDomainName-Test', {
    stackName: 'CloudFront-CustomDomainName-Test',
    // these env var get auto created when you run cdk synth or cdk deploy, will have to have it set in your config file
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
