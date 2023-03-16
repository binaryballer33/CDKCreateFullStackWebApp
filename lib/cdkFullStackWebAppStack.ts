import {App, Stack, StackProps} from '@aws-cdk/core';
import {Bucket, BucketEncryption, RedirectProtocol} from '@aws-cdk/aws-s3';
import {BucketDeployment, Source} from '@aws-cdk/aws-s3-deployment';
import {Certificate, CertificateValidation, DnsValidatedCertificate} from '@aws-cdk/aws-certificatemanager';
import {ARecord, HostedZone, IHostedZone, RecordTarget} from '@aws-cdk/aws-route53';
import {
    CloudFrontAllowedMethods,
    CloudFrontWebDistribution,
    OriginAccessIdentity,
    ViewerCertificate,
    ViewerProtocolPolicy
} from '@aws-cdk/aws-cloudfront';
import {AnyPrincipal, CanonicalUserPrincipal, Effect, PolicyStatement} from '@aws-cdk/aws-iam';
import {CloudFrontTarget} from "@aws-cdk/aws-route53-targets";

// TODO might need to create another record and another distribution just fot the root domain name shaquillemandy.com
// TODO I just don't feel like I'm doing Redirects correctly, will have to verify this
// TODO find out host to host different websites on the same domain name mandytec.shaquillemady.com, crwn-clothing.shaquillemady.com, etc.

export class CDKFullStackWebAppStack extends Stack {
    private WEB_SITE_FOLDER = 'build'; // the folder that contains the website code
    private WEB_PAGE_ROOT = 'index.html';
    private DOMAIN_NAME: string = 'shaquillemandy.com';
    private CLOUDFRONT_REGION_FOR_CERTIFICATES = 'us-east-1'; // CloudFront only checks us-east-1 for certificates.

    // calls the initializer to create the kind of web application that you want
    constructor(scope: App, id: string, props?: StackProps) {
        super(scope, id, props);
        // this.initializeS3StaticWebsite()
        // this.initializeCloudFrontWebsite()
        this.initializeCloudFrontWebsiteWithCustomDomainName();
    }

    // create the resources for the stack without a domain, certificate, hostedZone or CloudFront
    public initializeS3StaticWebsite(): Bucket {
        // setup S3 and BucketDeployment
        const s3SourceBucket: Bucket = this.createBucket();
        this.createRedirectBucket(); // create the redirect bucket
        s3SourceBucket.grantRead(new AnyPrincipal()); // allow public read access to the S3 bucket
        this.createBucketDeployment(s3SourceBucket); // deploy the code to the S3 bucket

        return s3SourceBucket;
    }

    // create the resources for the stack with CloudFront
    public initializeCloudFrontWebsite(): void {
        // Set up the s3SourceBucket and the s3RedirectBucket, deploy the code to the s3SourceBucket
        const s3SourceBucket: Bucket = this.initializeS3StaticWebsiteForCloudFront();

        // setup CloudFront, this distribution will use the randomly generated CloudFront domain name
        const originAccessIdentity: OriginAccessIdentity = this.createOriginAccessIdentity();
        this.createS3ToOAIBucketPolicy(s3SourceBucket, originAccessIdentity); // gives the OAI access to the S3 bucket
        const distribution: CloudFrontWebDistribution = this.createCloudFrontDistribution(s3SourceBucket, originAccessIdentity);
        this.createBucketDeploymentWithCloudFront(s3SourceBucket, distribution);
    }

    // create the resources for the stack with CloudFront using a Custom Domain Name
    public initializeCloudFrontWebsiteWithCustomDomainName(): void {
        // Set up the s3SourceBucket and the s3RedirectBucket, deploy the code to the s3SourceBucket
        const s3SourceBucket: Bucket = this.initializeS3StaticWebsiteForCloudFront();

        // setup Route53 and Amazon Certificate Manager
        const hostedZone: IHostedZone = this.getHostedZone();
        const certificate: Certificate = this.createCertificate(hostedZone);
        const viewerCertificate: ViewerCertificate = this.createViewerCertificate(certificate);

        // setup CloudFront with the custom domain name
        const originAccessIdentity: OriginAccessIdentity = this.createOriginAccessIdentity();
        this.createS3ToOAIBucketPolicy(s3SourceBucket, originAccessIdentity); // attach S3 To OAI policy to S3 bucket
        const distribution: CloudFrontWebDistribution = this.createCloudFrontDistributionWithCustomDomainName(s3SourceBucket, originAccessIdentity, viewerCertificate);
        this.createBucketDeploymentWithCloudFront(s3SourceBucket, distribution)

        // setup Route53 Alias Record to point to the CloudFront distribution
        this.createAliasRecord(hostedZone, distribution);
    }

    // create the S3 bucket
    private createBucket(): Bucket {
        return new Bucket(this, 'S3Bucket', {
            bucketName: `www.${this.DOMAIN_NAME}`,
            publicReadAccess: false, // because we are using CloudFront
            websiteIndexDocument: this.WEB_PAGE_ROOT,
            websiteErrorDocument: 'error.html',
            encryption: BucketEncryption.S3_MANAGED,
        });
    }

    // create redirect bucket so that when someone enters example.com it will redirect to www.example.com
    private createRedirectBucket(): Bucket {
        return new Bucket(this, 'S3RedirectBucket', {
            bucketName: this.DOMAIN_NAME,
            publicReadAccess: false,
            websiteIndexDocument: this.WEB_PAGE_ROOT,
            websiteRoutingRules: [{
                // this will redirectBucket route to the real bucket
                hostName: `www.${this.DOMAIN_NAME}`,
                httpRedirectCode: '302',
                protocol: RedirectProtocol.HTTPS,
            }],
        });
    }

    // deploys the code to the S3 bucket, doesn't use CloudFront
    private createBucketDeployment(s3SourceBucket: Bucket): BucketDeployment {
        return new BucketDeployment(this, 'S3BucketDeployment', {
            sources: [Source.asset(this.WEB_SITE_FOLDER)],
            destinationBucket: s3SourceBucket,
        });
    }

    // deploys the code to the S3 bucket, uses CloudFront distribution and each deployment will validate the cache
    private createBucketDeploymentWithCloudFront(s3SourceBucket: Bucket, distribution: CloudFrontWebDistribution): BucketDeployment {
        return new BucketDeployment(this, 'S3BucketDeployment', {
            sources: [Source.asset(this.WEB_SITE_FOLDER)],
            destinationBucket: s3SourceBucket,
            distribution: distribution,
            // Invalidate the cache for everything when we deploy so that cloudfront serves the latest site
            distributionPaths: ['/*'],
        });
    }

    // doesn't do the bucket deployment into after the CloudFront distribution is created
    private initializeS3StaticWebsiteForCloudFront(): Bucket {
        // setup S3 and BucketDeployment
        const s3SourceBucket: Bucket = this.createBucket();
        this.createRedirectBucket(); // create the redirect bucket

        return s3SourceBucket;
    }

    // find the current Route53 Hosted Zone for the domain
    private getHostedZone(): IHostedZone {
        /* Have to use the existing registered domain that you own
         * Do not create a new one because it won't have the same NS DNS servers as the one you registered
         * This will cause the certificate validation to fail, and you won't be able to use https or the customer domain
        */
        return HostedZone.fromLookup(this, 'HostedZone', {
            domainName: this.DOMAIN_NAME,
        })
    }

    // create the ACM certificate for the domain
    private createCertificate(hostedZone: IHostedZone): Certificate {
        return new DnsValidatedCertificate(this, 'Certificate', {
            domainName: `*.${this.DOMAIN_NAME}`, // includes all subdomains names like, www.example.com and example.com
            hostedZone: hostedZone,
            region: this.CLOUDFRONT_REGION_FOR_CERTIFICATES, // CloudFront only checks us-east-1 region for certificates.
            validation: CertificateValidation.fromDns(hostedZone),
        });
    }

    // create the viewerCertificate for the CloudFront distribution, also set the alias for the CloudFront distribution
    private createViewerCertificate(certificate: Certificate): ViewerCertificate {
        /*
         * aliases: The domain names that you want CloudFront to use to respond to requests for your distribution.
         * These domain names have to match the domain names that you specified when you requested your certificate.
         * if you have a wildcard certificate, you can use *.example.com as the alias. You can also specify a list of
         * domain names, for example, ["example.com", "www.example.com", "test.example.com"].
        */
        return ViewerCertificate.fromAcmCertificate(certificate, {aliases: [`*.${this.DOMAIN_NAME}`]});
    }

    // create the origin access identity for the CloudFront distribution to access the S3 bucket
    private createOriginAccessIdentity(): OriginAccessIdentity {
        return new OriginAccessIdentity(this, 'OriginAccessIdentity', {
            comment: 'Origin Access Identity for CloudFront Distribution to access S3 Bucket'
        });
    }

    // create the IAM policy that gives the OriginAccessIdentity access to the S3 bucket
    private createS3ToOAIBucketPolicy(s3SourceBucket: Bucket, originAccessIdentity: OriginAccessIdentity): PolicyStatement {
        return new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [s3SourceBucket.arnForObjects('*')], // allow access to all objects in the bucket
            principals: [
                new CanonicalUserPrincipal(originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId)
            ],
        });
    }

    // create the CloudFront distribution without a custom domain name
    private createCloudFrontDistribution(s3SourceBucket: Bucket, originAccessIdentity: OriginAccessIdentity): CloudFrontWebDistribution {
        return new CloudFrontWebDistribution(this, 'CloudFrontDistribution', {
            // originConfigs tells CloudFront where to get the files from and the behavior of the distribution
            originConfigs: [{
                s3OriginSource: {
                    s3BucketSource: s3SourceBucket, // the S3 bucket
                    originAccessIdentity: originAccessIdentity // this allows CloudFront to access the S3 bucket
                },
                behaviors: [{
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // redirect all HTTP requests to HTTPS
                    allowedMethods: CloudFrontAllowedMethods.GET_HEAD, // only allow GET and HEAD requests
                    compress: true, // compress files
                    isDefaultBehavior: true,
                }],
            }],
            defaultRootObject: this.WEB_PAGE_ROOT, // the default page to load
            errorConfigurations: [
                {errorCode: 403, responseCode: 200, responsePagePath: `/${this.WEB_PAGE_ROOT}`}, // redirect 403 errors to index.html
                {errorCode: 404, responseCode: 200, responsePagePath: `/${this.WEB_PAGE_ROOT}`}, // redirect 404 errors to index.html
            ],
        });
    }

    // create the CloudFront distribution with the custom domain name
    private createCloudFrontDistributionWithCustomDomainName(s3SourceBucket: Bucket, originAccessIdentity: OriginAccessIdentity, viewerCertificate: ViewerCertificate): CloudFrontWebDistribution {
        return new CloudFrontWebDistribution(this, 'CloudFrontDistribution', {
            // originConfigs tells CloudFront where to get the files from and the behavior of the distribution
            originConfigs: [{
                s3OriginSource: {
                    s3BucketSource: s3SourceBucket, // the S3 bucket
                    originAccessIdentity: originAccessIdentity // this allows CloudFront to access the S3 bucket
                },
                behaviors: [{
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // redirect all HTTP requests to HTTPS
                    allowedMethods: CloudFrontAllowedMethods.GET_HEAD, // only allow GET and HEAD requests
                    compress: true, // compress files
                    isDefaultBehavior: true,
                }],
            }],
            viewerCertificate: viewerCertificate, // the certificate for the domain attached to the CloudFront distribution
            defaultRootObject: this.WEB_PAGE_ROOT, // the default page to load
            errorConfigurations: [ // redirect 403 & 404 errors to index.html
                {errorCode: 403, responseCode: 200, responsePagePath: `/${this.WEB_PAGE_ROOT}`},
                {errorCode: 404, responseCode: 200, responsePagePath: `/${this.WEB_PAGE_ROOT}`},
            ],
        });
    }

    // The domain name inside the hosted zone will point to the CloudFront distribution alias
    private createAliasRecord(hostedZone: IHostedZone, cloudFrontDistribution: CloudFrontWebDistribution): ARecord {
        return new ARecord(this, 'AliasRecord', {
            zone: hostedZone,
            recordName: `www.${this.DOMAIN_NAME}`,
            target: RecordTarget.fromAlias(new CloudFrontTarget(cloudFrontDistribution)),
        });
    }
}
