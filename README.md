## This is a CDK application that creates all the infrastructure needed to run a website. 

#### AWS CLI AND CDK CLI & NPM STEPS
- Run `aws configure --profile <profileName>` to configure your aws credentials
  - cdk will get the credentials from there
  - You only have to specify the profile name if you have multiple profiles and you dont want to use the default profile
- Run `npm install` to install all the dependencies
- Run `cdk bootstrap` to bootstrap cdk inside your aws account, if you have not done so already
- Run `cdk synth --profile <profileName>` to see the cloudformation template that will be created
- Run `cdk deploy --profile <profileName>` to deploy the stack to your aws account


#### Mandatory and Optional Parameters For Initialization Methods 
For Each Method You Have To Give 
- domainName ( required ) - The Domain Name Of The Website
- websiteSourceCodeLocation ( required ) - The Location Of The Website Source Code Folder Relative To The Root Of The Project 
- websiteIndexDocument ( required ) - The Index Document Of The Website
- websiteErrorDocument ( optional ) -The Error Document Of The Website, Defaults To Index.html If Not Provided
- subdomainName ( optional ) - The Subdomain Name Of The Website, For Example www.example.com ( www is the subdomain name ) Defaults To www If Not Provided

### Running the app
- Create the stack using the code below, just uncomment the code snippet that you want to use

#### Create A S3 Static Website
```
#!/usr/bin/env node
import 'source-map-support/register';
import {App} from "@aws-cdk/core";
import {CDKFullStackWebAppStack} from '../lib/cdkFullStackWebAppStack';

const stack = new CDKFullStackWebAppStack(new App(), 'CreateWebsiteStack', {
    stackName: 'CreateWebsiteStack',
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});

stack.initializeS3StaticWebsite({
    websiteSourceCodeLocation: "build", // location of the website source code
    websiteIndexDocument: 'index.html', // index document of the website
    websiteErrorDocument: 'index.html', // error document of the website, defaults to index.html if not provided
    domainName: "shaquillemandy.com",   // domain name of the website, but for this method it will be the name of the bucket
})
```

#### Create A CloudFront Site With Random CloudFront Domain Name and HTTPS

```
#!/usr/bin/env node
import 'source-map-support/register';
import {App} from "@aws-cdk/core";
import {CDKFullStackWebAppStack} from '../lib/cdkFullStackWebAppStack';

const stack = new CDKFullStackWebAppStack(new App(), 'CreateWebsiteStack', {
    stackName: 'CreateWebsiteStack',
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});

stack.initializeCloudFrontWebsite({
    websiteIndexDocument: 'index.html',
    websiteSourceCodeLocation: "sourceCodePathLocation",
    domainName: "example.com",
})
```


#### Create A CloudFront Site With Custom Domain Name and HTTPS

```
#!/usr/bin/env node
import 'source-map-support/register';
import {App} from "@aws-cdk/core";
import {CDKFullStackWebAppStack} from '../lib/cdkFullStackWebAppStack';

const stack = new CDKFullStackWebAppStack(new App(), 'CreateWebsiteStack', {
    stackName: 'CreateWebsiteStack',
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});

// creates a www.example.com subdomain for the domain name that you enter
stack.initializeCloudFrontWebsiteWithCustomDomainName({
    websiteIndexDocument: 'index.html',
    websiteSourceCodeLocation: "sourceCodePathLocation",
    domainName: "example.com",  // domain name of the website and name of the s3 bucket
})
```
