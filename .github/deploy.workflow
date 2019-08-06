
action " Github Create Release" {
  uses = "frankjuniorr/github-create-release-action@master"
  needs = "New Tags Only"
  secrets = ["GITHUB_TOKEN"]
}
