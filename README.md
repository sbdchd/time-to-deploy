# time to deploy

> slack bot for reminding about heroku deployments

This is similar to setting up a `/remind`er in Slack but provides additional
information such as the diff between staging and production. The current
commit on production and when the code was last deployed. As well as if the
last deploy was a rollback.

## Why

Using a `/remind` works in slack but info is lacking. The Heroku dashboard
also doesn't show a diff between prod and staging when there was a rollback.

## Setup Up

### Slack

1. Navigate to <https://api.slack.com/apps>

2. Hit "Create New App" giving the app a name and selecting the workspace

3. Under "Add features and functionality" select "Permissions"

4. Add `chat:write:bot` as a permission

5. At the top of the page, still under "OAuth & Permissions" select "Install App to Workspace"

6. Copy the "OAuth Access Token" and save it for later. We'll need for deploying the app.

7. Navigate back to the "Basic Information" tab under "Settings" and
   configure the color, image, and description for the bot under "Display
   Information". Don't forget to hit "Save"!

### Deployment

1. Log into the AWS consule and navigate to <https://console.aws.amazon.com/lambda/#/functions>

2. Press the "Create function" button in the upper right hand corner.

3. Leave the "Author from scratch" section selected & fill out the function
   name with `time-to-deploy`. The default nodejs version is fine. Press "Create Function"

4. In the "Designer" panel press the "+ Add trigger" button and select "CloudWatch Events".

5. create a new rule giving it a name, this is going to be the cron that runs the deploy reminder.

6. in the schedule expression input `cron(30 14 ? * MON-FRI *)` which will run the job
   every weekday at 14:00 UTC. see
   <https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html>
   for more info on the cron format. Hit the add trigger button.

7. Back at the function detail page scroll down to the env and input the env
   vars according to the `.env-example` file located in this repo. Use the
   previous OAuth Acess Token that starts with `xoxp-` as the
   `TTD_SLACK_API_TOKEN`. For the `TTD_SLACK_CHANNEL_ID` you'll want to get the
   channel ID from the slack URL. Don't forget to save your changes.

8. Now we need to update our function with the actual code. Run `s/build` and
   `s/deploy`. If you didn't name your lambda function `time-to-deploy`, be
   sure to update the `s/deploy` script before running it.

### Test the Function

Run the function and ensure the deploy message appears in your Slack channel.

```shell
s/run
```

## Dev

```shell
yarn install

yarn test
yarn fmt
yarn typecheck

s/build

s/deploy

# run the lambda, usually for testing
s/run
```
