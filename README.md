# time to deploy

> Slack bot for reminding about Heroku deployments

<img alt="slack example message" width="600" src="./docs/example-message.png" />

## Why

Using a [reminder in Slack](https://slack.com/help/articles/208423427-Set-a-reminder)
works, but can't show dynamic content about current deployments. Also, for
some reason, the Heroku dashboard doesn't show a diff between prod and
staging when there was a rollback.

### Features

- diff between staging and production
- current commit on production
- when code was last deployed to production
- warning when last deploy was a rollback
- [promotion](https://devcenter.heroku.com/articles/pipelines#promoting) button from staging to prod
- links to staging and production envs
- deployment info updates on deploy

## Setup Up

### Slack

1. Navigate to <https://api.slack.com/apps>

2. Hit "Create New App" giving the app a name and selecting the workspace

3. Under "Add features and functionality" select "Permissions"

4. Add `chat:write:bot` as a permission

5. At the top of the page, still under "OAuth & Permissions" select "Install App to Workspace"

6. Copy the "OAuth Access Token" and save it for later. We'll need for deploying the app. (`TTD_SLACK_API_TOKEN`)

7. Navigate back to the "Basic Information" tab under "Settings" and
   configure the color, image, and description for the bot under "Display
   Information". Don't forget to hit "Save"!

### GitHub

1. Navigate to <https://github.com/settings/apps>

2. Hit "New GitHub App" and provide a name and home page url (can be anything, like <https://github.com/sbdchd/time-to-deploy>)

3. Scroll to the "Webhook" section and uncheck "Active"

4. Scroll to "Repository permissions" and select "read-only" for "Contents"

5. Scroll to bottom and click "Create GitHub App"

6. Record your "App ID" (`TTD_GITHUB_APP_ID`) shown under the "About" section

7. Scroll to "Private keys" and click, "Generate a private key"

8. Convert the downloaded private key to base64. For example, `base64 my-app-name.2020-01-01.private-key.pem`. Use this encoded value for `TTD_GITHUB_APP_PRIVATE_KEY_BASE_64`.

9. On the left hand side click "Install App". Install the app.

10. Note the ID in your URL. For example, from the URL `https://github.com/settings/installations/15330603`, the installation ID would be "15330603" (`TTD_GITHUB_INSTALL_ID`).

### Deployment

1. Log into the AWS console and navigate to <https://console.aws.amazon.com/lambda/#/functions>

2. Press the "Create function" button in the upper right hand corner.

3. Leave the "Author from scratch" section selected & fill out the function
   name with `time-to-deploy`. The default nodejs version is fine. Press "Create Function"

4. At your lambda function's homepage, click "Copy ARN" and save the value for later.

5. Under "Configuration", edit the "General Configuration" to provide 512MB of RAM and 30 second timeout.

6. At the function homepage, press the "+ Add trigger" button and select "CloudWatch Events".

7. create a new rule giving it a name, this is going to be the cron that runs the deploy reminder.

8. in the schedule expression input `cron(30 14 ? * MON-FRI *)` which will run the job
   every weekday at 14:00 UTC. see
   <https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html>
   for more info on the cron format. Hit the add trigger button.

9. [Create a Dynamodb table](https://console.aws.amazon.com/dynamodbv2/home#create-table) with the table name `time-to-deploy` and the partition key as `pk`.

10. [Create a new IAM policy](https://console.aws.amazon.com/iam/home#/policies$new?step=edit) to give read and write access to the dynamodb table. Select `DynamoDB` as the Service. Under Actions, enable `GetItem` under the Read section and `PutItem` in the Write section. Under Resources, add your lambda's ARN you copied earlier.

11. [Find the IAM Role](https://console.aws.amazon.com/iamv2/home#/roles) coresponding to the lambda function. It should start with `time-to-deploy-role`. CLick "Attach Policies", then select your newly created IAM policy.

12. Back at the function detail page scroll down to the env and input the env
   vars according to the `.env-example` file located in this repo. Use the
   previous OAuth Acess Token that starts with `xoxp-` as the
   `TTD_SLACK_API_TOKEN`. For the `TTD_SLACK_CHANNEL_ID` you'll want to get the
   channel ID from the Slack URL. Don't forget to save your changes.

13. Now we need to update our function with the actual code. Run `s/build` and
   `s/deploy`. If you didn't name your lambda function `time-to-deploy`, be
   sure to update the `s/deploy` script before running it.

14. Setup an API Gateway so external HTTP requests can trigger the lambda. Click "+ trigger" on the function homepage and create an `HTTP API` with `open security`. Navigate back to your lambda function homepage and click the new "API Gateway" trigger and copy the API endpoint URL. Append `?auth_token=your_http_auth_token_here` to the URL and configure it as a Heroku deploy hook for all of your Heroku apps.

- "+ trigger", create api, http api, open security. go back to the lambda function homepage, click the new "API Gateway" trigger, copy the API endpoint URL and append "?auth_token=your_auth_token_here" to the URL to use as a Heroku deploy hook. The URL should look like: `https://e478006295.execute-api.us-east-1.amazonaws.com/default/time-to-deploy?auth_token=your-http-secret-here`

15. Hookup [Heroku post deploy
    hooks](https://devcenter.heroku.com/articles/deploy-hooks#http-post-hook)
    for each env of the apps to the API Gateway.

16. Optionally set a SENTRY_DSN in your environment variables to get Sentry error reports.

### Test the Function

Run the function and ensure the deploy message appears in your Slack channel.

```shell
s/run
```

## Dev

```shell
yarn install

s/lint
s/test

s/build

s/deploy

# run the lambda, usually for testing
s/run
```
