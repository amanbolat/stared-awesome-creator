package star

type Star struct {
	RepoUrl string `dynamo:"repo_url"`
	Stars int `dynamo:"stars"`
}
