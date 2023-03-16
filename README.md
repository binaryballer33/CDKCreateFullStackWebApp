# This is a CDK application that creates all the infrastructure needed to run a website. 

### You can choose the type of website that you want to create by calling the appropriate method in the constructor
- `this.initializeS3StaticWebsite()` - Creates a static website using S3, doesn't have HTTPS, Bucket is public
- `this.initializeCloudFrontWebsite()` - Creates a website using S3 and CloudFront, has HTTPS, Bucket is private
- `this.initializeCloudFrontWebsiteWithCustomDomainName()` - Creates a website using S3 and CloudFront, has HTTPS, Bucket is private, and uses a custom domain name
