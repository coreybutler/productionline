workflow "Automatically Tag Commit" {
  on = "push"
  resolves = [
    "Create Release",
    "Slack Notification",
  ]
}

action "Restrict to Master Branch" {
  uses = "actions/bin/filter@master"
  args = "branch master"
}

# Filter for master branch
action "Master" {
  uses = "actions/bin/filter@master"
  args = "branch master"
}

action "Autotag" {
  uses = "author/action-autotag@master"
  needs = ["Master"]
  secrets = ["GITHUB_TOKEN"]
}

action "Create Release" {
  uses = "frankjuniorr/github-create-release-action@master"
  needs = ["Autotag"]
  secrets = ["GITHUB_TOKEN"]
}

action "Publish to npm" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  needs = ["Autotag"]
  secrets = ["NPM_AUTH_TOKEN"]
}

action "Slack Notification" {
  uses = "Ilshidur/action-slack@e53b10281b03b02b016e1c7e6355200ee4d93d6d"
  secrets = ["SLACK_WEBHOOK"]
  needs = ["Publish to npm"]
  env = {
    SLACK_OVERRIDE_MESSAGE = ""
  }
  args = "Update"
}
