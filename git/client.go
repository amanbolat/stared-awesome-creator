package git

import (
	"context"
	"errors"
	"fmt"
	"github.com/google/go-github/v33/github"
	"github.com/shurcooL/githubv4"
	"golang.org/x/oauth2"
	"net/url"
	"strings"
	"time"
)

type Repo struct {
	Owner, Name string
}

type Client struct {
	ghRestClient *github.Client
	ghGraphClient *githubv4.Client
	AuthorName string
	AuthorEmail string
}

func NewClient(githubToken string) *Client {
	tokenSource := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: githubToken},
	)
	httpClient := oauth2.NewClient(context.Background(), tokenSource)
	httpClient.Timeout = time.Second * 30
	githubGraphClient := githubv4.NewClient(httpClient)

	return &Client{
		ghRestClient: github.NewClient(httpClient),
		ghGraphClient: githubGraphClient,
		AuthorName:   "awesome list creator",
		AuthorEmail:  "awesomelistcreator@example.com",
	}
}

func (c *Client) UpdateFile(repo Repo, branch string, fileName string, update []byte) error {
	// get branch
	b, _, err := c.ghRestClient.Repositories.GetBranch(context.Background(), repo.Owner, repo.Name, branch)
	if err != nil {
		return fmt.Errorf("failed to get branch, %s", err)
	}

	// get last commit
	lastCommit, _, err := c.ghRestClient.Repositories.GetCommit(context.Background(), repo.Owner, repo.Name, b.Commit.GetSHA())
	if err != nil {
		return fmt.Errorf("failed to get last commit, %s", err)
	}

	var lastCommitSha *string
	for _, f := range lastCommit.Files {
		if *f.Filename == fileName {
			lastCommitSha = f.SHA
		}
	}

	// Upload awesome lists with star
	opts := &github.RepositoryContentFileOptions{
		Message: github.String(fmt.Sprintf("updated at: %s", time.Now().Format(time.RFC822))),
		Content: update,
		SHA:     lastCommitSha,
		Branch:  github.String(branch),
		Committer: &github.CommitAuthor{
			Name:  github.String(c.AuthorName),
			Email: github.String(c.AuthorEmail),
		},
	}

	_, _, err = c.ghRestClient.Repositories.UpdateFile(context.Background(), repo.Owner, repo.Name, fileName, opts)
	if err != nil {
		return fmt.Errorf("failed to upload awesome list with stars, %s", err)
	}

	return nil
}

// GetStarsCountFor return count of stars or -1 on error
func (c *Client) GetStarsCountFor(repoUrl *url.URL) (int, error) {
	owner, name := repoFromPath(repoUrl)
	if owner == "" || name == "" {
		return -1, errors.New("unable retrieve owner and name")
	}
	var q struct {
		Repository struct {
			StargazerCount githubv4.Int
		} `graphql:"repository(owner: $owner, name: $name)"`
	}
	args := map[string]interface{}{
		"owner": githubv4.String(owner),
		"name":  githubv4.String(name),
	}

	err := c.ghGraphClient.Query(context.Background(), &q, args)
	if err != nil {
		return -1, fmt.Errorf("unable fetch repo stars, %s", err)
	}

	return int(q.Repository.StargazerCount), nil
}

// repoFromPath return owner and name of the repo from url
func repoFromPath(u *url.URL) (owner string, name string) {
	arr := strings.Split(u.Path, "/")
	var res []string
	for _, e := range arr {
		str := strings.TrimSpace(e)
		if str != "" {
			res = append(res, str)
		}
	}
	if len(res) > 1 {
		owner = strings.TrimSpace(res[0])
		name = strings.TrimSpace(res[1])
	}
	return
}
