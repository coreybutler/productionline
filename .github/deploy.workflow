workflow "New workflow" {
  on = "create"
  resolves = ["Create Release"]
}

action "Tags Only" {
  uses = "actions/bin/filter@0dbb077f64d0ec1068a644d25c71b1db66148a24"
  args = "tag"
}

action "Create Release" {
  uses = "frankjuniorr/github-create-release-action@master"
  needs = ["Tags Only"]
  secrets = ["GITHUB_TOKEN"]
}
