workflow "Automatically Tag Commit" {
  on = "push"
  resolves = ["Autotag"]
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
