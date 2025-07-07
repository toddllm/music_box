#!/bin/bash
# Setup GitHub OIDC for Music Box CI/CD

set -e

echo "🔧 Setting up GitHub OIDC for Music Box CI/CD"
echo ""

# Check if GITHUB_USERNAME is set
if [ -z "$GITHUB_USERNAME" ]; then
  echo "❌ Error: Please set GITHUB_USERNAME environment variable"
  echo "   Example: export GITHUB_USERNAME=yourusername"
  exit 1
fi

ACCOUNT_ID=717984198385
AWS_REGION=us-east-1

echo "📋 Configuration:"
echo "   AWS Account: $ACCOUNT_ID"
echo "   AWS Region: $AWS_REGION"
echo "   GitHub Username: $GITHUB_USERNAME"
echo "   Repository: $GITHUB_USERNAME/music_box"
echo ""

# Step 1: Create OIDC provider if it doesn't exist
echo "1️⃣ Checking OIDC provider..."
if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" 2>/dev/null; then
  echo "   Creating GitHub OIDC provider..."
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
  echo "   ✅ OIDC provider created"
else
  echo "   ✅ OIDC provider already exists"
fi

# Step 2: Update trust policy with correct GitHub username
echo ""
echo "2️⃣ Updating trust policy with GitHub username..."
sed -i.bak "s/YOUR_GITHUB_USERNAME/$GITHUB_USERNAME/g" iam/github-oidc-trust-policy.json
echo "   ✅ Trust policy updated"

# Step 3: Create IAM roles
echo ""
echo "3️⃣ Creating IAM roles..."

# ECR Push Role
echo "   Creating github-oidc-ecr-push role..."
aws iam create-role \
  --role-name github-oidc-ecr-push \
  --assume-role-policy-document file://iam/github-oidc-trust-policy.json \
  --description "GitHub Actions role for pushing to ECR" 2>/dev/null || echo "   Role already exists, updating..."

aws iam put-role-policy \
  --role-name github-oidc-ecr-push \
  --policy-name ecr-push-policy \
  --policy-document file://iam/github-oidc-ecr-push-policy.json

echo "   ✅ ECR push role ready"

# Deploy Role
echo "   Creating github-oidc-deploy role..."
aws iam create-role \
  --role-name github-oidc-deploy \
  --assume-role-policy-document file://iam/github-oidc-trust-policy.json \
  --description "GitHub Actions role for deploying services" 2>/dev/null || echo "   Role already exists, updating..."

aws iam put-role-policy \
  --role-name github-oidc-deploy \
  --policy-name deploy-policy \
  --policy-document file://iam/github-oidc-deploy-policy.json

echo "   ✅ Deploy role ready"

# Step 4: Create ECR repositories if they don't exist
echo ""
echo "4️⃣ Checking ECR repositories..."

for repo in "noagenda-mixer-production" "music-box-realtime"; do
  if ! aws ecr describe-repositories --repository-names $repo --region $AWS_REGION 2>/dev/null; then
    echo "   Creating ECR repository: $repo"
    aws ecr create-repository --repository-name $repo --region $AWS_REGION
  else
    echo "   ✅ Repository $repo already exists"
  fi
done

# Step 5: Update serverless-production.yml if needed
echo ""
echo "5️⃣ Checking serverless configuration..."
if [ -f "mixer/serverless-production.yml" ]; then
  echo "   ✅ serverless-production.yml found"
  # Add check for imageTag parameter support here if needed
else
  echo "   ⚠️  mixer/serverless-production.yml not found - you'll need to create it"
fi

echo ""
echo "✅ GitHub OIDC setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Commit and push these changes to your repository:"
echo "   git add ."
echo "   git commit -m 'Add GitHub Actions CI/CD pipeline'"
echo "   git push origin main"
echo ""
echo "2. The workflow will trigger on:"
echo "   - Push to main branch (if mixer/ or realtime-service/ files change)"
echo "   - Manual dispatch from GitHub Actions tab"
echo ""
echo "3. Monitor the build at:"
echo "   https://github.com/$GITHUB_USERNAME/music_box/actions"
echo ""
echo "🚀 Ready to build and deploy!"