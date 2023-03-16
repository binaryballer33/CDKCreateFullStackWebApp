# This is a CDK application that creates all the infrastructure needed to run a website. 

### You can choose the type of website that you want to create by calling the appropriate method in the constructor
- `this.initializeS3StaticWebsite()` - Creates a static website using S3, doesn't have HTTPS, Bucket is public
- `this.initializeCloudFrontWebsite()` - Creates a website using S3 and CloudFront, has HTTPS, Bucket is private
- `this.initializeCloudFrontWebsiteWithCustomDomainName()` - Creates a website using S3 and CloudFront, has HTTPS, Bucket is private, and uses a custom domain name
    - This method requires you to have a hosted zone in Route53 using the domain name of the domain that you have registered
    - At the current moment you have to go into the code and change the constant values to match your setup
    - You must change WEBSITE_FOLDER & DOMAIN_NAME

### Running the app
- Create the stack using the code below
```
#!/usr/bin/env node
import 'source-map-support/register';
import {App} from "@aws-cdk/core";
import {CDKFullStackWebAppStack} from '../lib/cdkFullStackWebAppStack';

const app = new App();

new CDKFullStackWebAppStack(app, 'CloudFront-CustomDomainName-Test', {
    stackName: 'CloudFront-CustomDomainName-Test',
    // these env var get auto created when you run cdk synth or cdk deploy, will have to have it set in your config file
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
```
