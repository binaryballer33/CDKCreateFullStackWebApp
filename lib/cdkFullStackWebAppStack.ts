import {App, Stack, StackProps} from '@aws-cdk/core';
import {Bucket, BucketEncryption} from '@aws-cdk/aws-s3';
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

export interface ICDKFullStackWebAppStackProps {
    domainName: string; // the domain name that you want to use for ex example.com
    websiteSourceCodeLocation: string;  // the folder that contains the website code
    websiteIndexDocument: string;
    websiteErrorDocument?: string;
    subdomain?: string // the subdomain portion of the url for ex [www, api, docs] etc
}

export class CDKFullStackWebAppStack extends Stack {
    constructor(scope: App, id: string, props?: StackProps) {
        super(scope, id, props);
    }
    private CLOUDFRONT_REGION_FOR_CERTIFICATES = 'us-east-1'; // CloudFront only checks us-east-1 for certificates.

    // create the resources for the stack without a domain, certificate, hostedZone or CloudFront
    public initializeS3StaticWebsite(config: ICDKFullStackWebAppStackProps): Bucket {
        // setup S3 and BucketDeployment
        const s3SourceBucket: Bucket = this.createBucket(config);
        s3SourceBucket.grantRead(new AnyPrincipal()); // allow public read access to the S3 bucket
        this.createBucketDeployment(s3SourceBucket, config); // deploy the code to the S3 bucket

        return s3SourceBucket;
    }

    // create the resources for the stack with CloudFront
    public initializeCloudFrontWebsite(config: ICDKFullStackWebAppStackProps): void {
        // Set up the s3SourceBucket and the s3RedirectBucket, deploy the code to the s3SourceBucket
        const s3SourceBucket: Bucket = this.createBucket(config);

        // setup CloudFront, this distribution will use the randomly generated CloudFront domain name
        const originAccessIdentity: OriginAccessIdentity = this.createOriginAccessIdentity();
        this.createS3ToOAIBucketPolicy(s3SourceBucket, originAccessIdentity); // gives the OAI access to the S3 bucket
        const distribution: CloudFrontWebDistribution = this.createCloudFrontDistribution(s3SourceBucket, originAccessIdentity, config);
        this.createBucketDeploymentWithCloudFront(s3SourceBucket, distribution, config);
    }

    // create the resources for the stack with CloudFront using a Custom Domain Name
    public initializeCloudFrontWebsiteWithCustomDomainName(config: ICDKFullStackWebAppStackProps): void {
        // Set up the s3SourceBucket and the s3RedirectBucket, deploy the code to the s3SourceBucket
        const s3SourceBucket: Bucket = this.createBucket(config);

        // setup Route53 and Amazon Certificate Manager
        const hostedZone: IHostedZone = this.getHostedZone(config);
        const certificate: Certificate = this.createCertificate(hostedZone, config);
        const viewerCertificate: ViewerCertificate = this.createViewerCertificate(certificate, config);

        // setup CloudFront with the custom domain name
        const originAccessIdentity: OriginAccessIdentity = this.createOriginAccessIdentity();
        this.createS3ToOAIBucketPolicy(s3SourceBucket, originAccessIdentity); // attach S3 To OAI policy to S3 bucket
        const distribution: CloudFrontWebDistribution = this.createCloudFrontDistributionWithCustomDomainName(s3SourceBucket, originAccessIdentity, viewerCertificate, config);
        this.createBucketDeploymentWithCloudFront(s3SourceBucket, distribution, config)

        // setup Route53 Alias Record to point to the domain name to the CloudFront distribution
        this.createAliasRecord(hostedZone, distribution, config);
    }

    // create the S3 bucket
    private createBucket(config: ICDKFullStackWebAppStackProps): Bucket {
        return new Bucket(this, 'S3Bucket', {
            bucketName: `${config.subdomain ? config.subdomain : 'www'}.${config.domainName}`,
            publicReadAccess: false, // will get modified it this is a s3 static website
            websiteIndexDocument: config.websiteIndexDocument,
            websiteErrorDocument: config.websiteErrorDocument,
            encryption: BucketEncryption.S3_MANAGED,
        });
    }

    // deploys the code to the S3 bucket, doesn't use CloudFront
    private createBucketDeployment(s3SourceBucket: Bucket, config: ICDKFullStackWebAppStackProps): BucketDeployment {
        return new BucketDeployment(this, 'S3BucketDeployment', {
            sources: [Source.asset(config.websiteSourceCodeLocation)],
            destinationBucket: s3SourceBucket,
        });
    }

    // deploys the code to the S3 bucket, uses CloudFront distribution and each deployment will validate the cache
    private createBucketDeploymentWithCloudFront(s3SourceBucket: Bucket, distribution: CloudFrontWebDistribution, config: ICDKFullStackWebAppStackProps): BucketDeployment {
        return new BucketDeployment(this, 'S3BucketDeployment', {
            sources: [Source.asset(config.websiteSourceCodeLocation)],
            destinationBucket: s3SourceBucket,
            distribution: distribution,
            // Invalidate the cache for everything when we deploy so that cloudfront serves the latest site
            distributionPaths: ['/*'],
        });
    }

    // find the current Route53 Hosted Zone for the domain
    private getHostedZone(config: ICDKFullStackWebAppStackProps): IHostedZone {
        /* Have to use the existing registered domain that you own
         * Do not create a new one because it won't have the same NS DNS servers as the one you registered
         * This will cause the certificate validation to fail, and you won't be able to use https or the customer domain
        */
        return HostedZone.fromLookup(this, 'HostedZone', {
            domainName: config.domainName,
        })
    }

    // create the ACM certificate for the domain
    private createCertificate(hostedZone: IHostedZone, config: ICDKFullStackWebAppStackProps): Certificate {
        return new DnsValidatedCertificate(this, 'Certificate', {
            hostedZone: hostedZone,
            region: this.CLOUDFRONT_REGION_FOR_CERTIFICATES, // CloudFront only checks us-east-1 region for certificates.
            domainName: config.domainName, // includes all subdomains names like, www.example.com and docs.example.com
            subjectAlternativeNames: [`*.${config.domainName}`], // includes all subdomains names
            validation: CertificateValidation.fromDns(hostedZone),
            cleanupRoute53Records: true, // remove the Route53 records after the certificate is created
        });
    }

    // create the viewerCertificate for the CloudFront distribution, also set the alias for the CloudFront distribution
    private createViewerCertificate(certificate: Certificate, config: ICDKFullStackWebAppStackProps): ViewerCertificate {
        /*
         * aliases: The domain names that you want CloudFront to use to respond to requests for your distribution.
         * These domain names have to match the domain names that you specified when you requested your certificate.
         * if you have a wildcard certificate, you can use *.example.com as the alias. You can also specify a list of
         * domain names, for example, ["example.com", "www.example.com", "test.example.com"].
        */
        return ViewerCertificate.fromAcmCertificate(
            certificate, {aliases: [`${config.subdomain ? config.subdomain : 'www'}.${config.domainName}`]}
        );
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
    private createCloudFrontDistribution(s3SourceBucket: Bucket, originAccessIdentity: OriginAccessIdentity, config: ICDKFullStackWebAppStackProps): CloudFrontWebDistribution {
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
            defaultRootObject: config.websiteIndexDocument, // the default page to load
            errorConfigurations: [
                {errorCode: 403, responseCode: 200, responsePagePath: `/${config.websiteErrorDocument? config.websiteErrorDocument : config.websiteIndexDocument}`}, // redirect 403 errors to index.html
                {errorCode: 404, responseCode: 200, responsePagePath: `/${config.websiteErrorDocument? config.websiteErrorDocument : config.websiteIndexDocument}`}, // redirect 404 errors to index.html
            ],
        });
    }

    // create the CloudFront distribution with the custom domain name
    private createCloudFrontDistributionWithCustomDomainName(s3SourceBucket: Bucket, originAccessIdentity: OriginAccessIdentity, viewerCertificate: ViewerCertificate, config: ICDKFullStackWebAppStackProps): CloudFrontWebDistribution {
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
            defaultRootObject: config.websiteIndexDocument, // the default page to load
            errorConfigurations: [
                {errorCode: 403, responseCode: 200, responsePagePath: `/${config.websiteErrorDocument? config.websiteErrorDocument : config.websiteIndexDocument}`}, // redirect 403 errors to index.html
                {errorCode: 404, responseCode: 200, responsePagePath: `/${config.websiteErrorDocument? config.websiteErrorDocument : config.websiteIndexDocument}`}, // redirect 404 errors to index.html
            ],
        });
    }

    // The domain name inside the hosted zone will point to the CloudFront distribution alias
    private createAliasRecord(hostedZone: IHostedZone, cloudFrontDistribution: CloudFrontWebDistribution, config: ICDKFullStackWebAppStackProps): ARecord {
        return new ARecord(this, 'AliasRecord', {
            zone: hostedZone,
            recordName: `${config.subdomain ? config.subdomain : 'www'}.${config.domainName}`,
            target: RecordTarget.fromAlias(new CloudFrontTarget(cloudFrontDistribution)),
        });
    }
}
