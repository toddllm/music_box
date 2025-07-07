# Music Box CI/CD Setup Guide

This guide explains how to set up GitHub Actions CI/CD for building and deploying the Music Box services without needing Docker locally.

## 🚀 Quick Start

### 1. Set Up GitHub OIDC Authentication

First, export your GitHub username and run the setup script:

```bash
export GITHUB_USERNAME=your-github-username
./setup-github-oidc.sh
```

This script will:
- Create GitHub OIDC provider in AWS
- Set up IAM roles for GitHub Actions
- Create ECR repositories if needed
- Update trust policies with your GitHub username

### 2. Repository Structure

The CI/CD pipeline expects:
```
music_box/
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Main game deployment (existing)
│       └── deploy-services.yml # Services deployment (new)
├── mixer/
│   ├── Dockerfile
│   └── serverless-production.yml
├── realtime-service/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
└── iam/
    ├── github-oidc-trust-policy.json
    ├── github-oidc-ecr-push-policy.json
    └── github-oidc-deploy-policy.json
```

### 3. Workflow Triggers

The services deployment workflow (`deploy-services.yml`) triggers on:

- **Push to main branch** when files change in:
  - `mixer/**`
  - `realtime-service/**`
  - `.github/workflows/deploy-services.yml`

- **Manual dispatch** from GitHub Actions tab with options:
  - Deploy all services
  - Deploy mixer only
  - Deploy realtime only

## 📦 What Gets Built and Deployed

### Mixer Service
1. Builds Docker image from `mixer/Dockerfile`
2. Tags with commit SHA and `latest`
3. Pushes to ECR: `noagenda-mixer-production`
4. Deploys via Serverless Framework

### Realtime Service
1. Builds Docker image from `realtime-service/Dockerfile`
2. Tags with commit SHA and `latest`
3. Pushes to ECR: `music-box-realtime`
4. Updates ECS task definition and service

## 🔐 Security

- **No stored secrets**: Uses GitHub OIDC for temporary AWS credentials
- **Least privilege**: Separate roles for ECR push and deployment
- **Scoped access**: Roles only work for your specific repository

## 🛠️ Troubleshooting

### OIDC Provider Already Exists
This is fine - the script handles it gracefully.

### Permission Denied Errors
Check that the IAM roles were created:
```bash
aws iam get-role --role-name github-oidc-ecr-push
aws iam get-role --role-name github-oidc-deploy
```

### Build Failures
Check GitHub Actions logs:
```
https://github.com/YOUR_USERNAME/music_box/actions
```

### ECR Login Issues
Ensure the ECR repositories exist:
```bash
aws ecr describe-repositories --repository-names noagenda-mixer-production
aws ecr describe-repositories --repository-names music-box-realtime
```

## 📊 Monitoring Deployments

### GitHub Actions UI
- Go to Actions tab in your repository
- Click on a workflow run to see detailed logs
- Re-run failed jobs if needed

### AWS Console
- **ECR**: Check pushed images
- **ECS**: Monitor service deployments
- **Lambda**: View function updates

### CLI Commands
```bash
# Check latest mixer image
aws ecr describe-images \
  --repository-name noagenda-mixer-production \
  --query 'sort_by(imageDetails,& imagePushedAt)[-1]'

# Check ECS service status
aws ecs describe-services \
  --cluster music-box-realtime-cluster \
  --services music-box-realtime-service
```

## 🔄 Rollback

### Mixer Service
Deploy a previous commit:
```bash
# From GitHub Actions UI, re-run a previous successful workflow
# Or use serverless CLI locally with specific image tag
```

### Realtime Service
Update ECS to previous task definition:
```bash
aws ecs update-service \
  --cluster music-box-realtime-cluster \
  --service music-box-realtime-service \
  --task-definition music-box-realtime-service:13
```

## 📝 Local Testing (Optional)

If someone on the team has Docker:
```bash
# Build and test locally
cd mixer
docker build -t mixer-test .
docker run -p 8080:8080 mixer-test

# Push manually if needed
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
docker tag mixer-test $ECR_REGISTRY/noagenda-mixer-production:manual-test
docker push $ECR_REGISTRY/noagenda-mixer-production:manual-test
```

## 🎯 Next Steps

1. Run `./setup-github-oidc.sh` with your GitHub username
2. Commit and push changes
3. Watch the magic happen in GitHub Actions
4. Test your endpoints:
   - Mixer: `POST /mix/professional-lite`
   - WebSocket: `wss://music-box-realtime-alb-417242201.us-east-1.elb.amazonaws.com/`

---

**Need Help?** 
- Check workflow logs in GitHub Actions
- Review AWS CloudWatch logs
- Ensure IAM roles have correct permissions