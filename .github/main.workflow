workflow "Build, Test, and Publish" {
  on = "push"
  resolves = ["Master"]
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
