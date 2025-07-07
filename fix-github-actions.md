# Fix GitHub Actions AWS Authentication

The current workflow is failing because it's trying to use `secrets.AWS_ROLE_ARN` which isn't configured. You have two options:

## Option 1: Set up GitHub OIDC (Recommended)

Run these commands to create the necessary AWS resources:

```bash
# Set up OIDC provider and roles
export GITHUB_USERNAME=toddllm
./setup-github-oidc.sh
```

Then update `.github/workflows/deploy.yml` to use OIDC authentication:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::717984198385:role/github-oidc-deploy
    aws-region: ${{ env.AWS_REGION }}
```

## Option 2: Use AWS Access Keys (Quick Fix)

1. Go to https://github.com/toddllm/music_box/settings/secrets/actions
2. Add these secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

3. Update `.github/workflows/deploy.yml`:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ${{ env.AWS_REGION }}
```

## Option 3: Create the Missing IAM Role

If you want to keep using `secrets.AWS_ROLE_ARN`, create an IAM role and add it as a GitHub secret:

1. Create IAM role with GitHub OIDC trust
2. Go to https://github.com/toddllm/music_box/settings/secrets/actions
3. Add secret `AWS_ROLE_ARN` with value: `arn:aws:iam::717984198385:role/your-role-name`

## Current Status

- Your repository is public at https://github.com/toddllm/music_box
- You have one workflow: "Deploy Music Box to AWS"
- The last run failed due to missing AWS credentials
- The workflow is triggered on push to main branch

## Next Steps

1. Choose one of the authentication options above
2. Update the workflow file accordingly
3. Push the changes to trigger a new run

The services deployment workflow (`deploy-services.yml`) I created is already set up to use OIDC, so Option 1 would align both workflows.