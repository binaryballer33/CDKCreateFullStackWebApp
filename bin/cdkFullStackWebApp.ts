#!/usr/bin/env node
import 'source-map-support/register';
import {App} from "@aws-cdk/core";
import {CDKFullStackWebAppStack} from '../lib/cdkFullStackWebAppStack';

const app = new App();

new CDKFullStackWebAppStack(app, 'CloudFront-CustomDomainName-Test', {
    stackName: 'CloudFront-CustomDomainName-Test',
    // these env var get auto created when you run cdk synth or cdk deploy, will have to have it set in your config file
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

    // I created these env var in  the .zshrc, use these to target non default values
    // env: { account: process.env.AWS_PERSONAL_ACCOUNT, region: process.env.AWS_DEFAULT_REGION },
});
