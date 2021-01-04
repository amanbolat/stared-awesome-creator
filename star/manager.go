package star

import (
	"bytes"
	"context"
	"fmt"
	"github.com/google/go-github/v33/github"
	"github.com/guregu/dynamo"
	"github.com/shurcooL/githubv4"
	"github.com/sirupsen/logrus"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
	"golang.org/x/oauth2"
	"stared-awesome-creator/awesome"
	mdrender "stared-awesome-creator/mdrenderer"
	"time"
)

const repoOwner = "amanbolat"
const repoBranch = "main"
const repoReadmeFile = "README.md"
const starCacheTable = "awesome_list_stars"

// Manager is responsible for whole process of updating awesome lists
// with stars.
type Manager struct {
	linkProcessor *LinkProcessor
	// ghRestClient is a github API v3 client
	ghRestClient *github.Client
	db           *dynamo.DB
}

func NewManager(githubToken string, db *dynamo.DB) *Manager {
	tokenSource := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: githubToken},
	)
	httpClient := oauth2.NewClient(context.Background(), tokenSource)
	httpClient.Timeout = time.Second * 15
	githubGraphClient := githubv4.NewClient(httpClient)
	m := Manager{
		linkProcessor: NewLinkProcessor(githubGraphClient),
		ghRestClient:  github.NewClient(httpClient),
		db:            db,
	}

	return &m
}

// removeUnusedParts
func (m *Manager) removeUnusedParts(list *awesome.AwesomeList, rootNode ast.Node) {
	list.RemoveUnusedParts(list.ReadmeBody, rootNode)
}

// withAboutText adds description to the top of the given list
// and returns new buffer.
// Should be called ONLY at the end of processing and adding stars.
func (m *Manager) withAboutText(b []byte, rootNode ast.Node, aboutText string) []byte {
	buf := bytes.NewBuffer([]byte(aboutText))
	buf.Write(b)

	return buf.Bytes()
}

// parseLinks parses all the links and saves them for later usage
func (m *Manager) parseLinks(buf []byte, node ast.Node) {
	if node.Kind() == ast.KindLink {
		link := node.(*ast.Link)
		m.linkProcessor.SaveLink(link)
	}

	if node.HasChildren() {
		m.parseLinks(buf, node.FirstChild())
		next := node.FirstChild().NextSibling()
		for next != nil {
			m.parseLinks(buf, next)
			next = next.NextSibling()
		}
	}
}

func (m *Manager) StarList(list *awesome.AwesomeList) error {
	mdTextReader := text.NewReader(list.ReadmeBody)
	rootNode := goldmark.DefaultParser().Parse(mdTextReader)
	m.removeUnusedParts(list, rootNode)
	m.parseLinks(list.ReadmeBody, rootNode)
	logrus.WithField("list_name", list.Name).WithField("links_found", len(m.linkProcessor.links)).Info("parsed links")

	// Get stars for every link one by one in order to
	// not to hit rate limit.
	for link, repoUrl := range m.linkProcessor.linkUrlMap {
		stars, err := m.linkProcessor.getStarCountFor(repoUrl)
		if err != nil {
			logrus.WithError(err).WithField("repo_url", repoUrl.String()).Error("unable to get stars from github api")
			var star Star
			err = m.db.Table(starCacheTable).Get("repo_url", repoUrl.String()).One(&star)
			if err != nil {
				logrus.WithError(err).WithField("repo_url", repoUrl.String()).Error("unable to get stars from cache")
				continue
			}
			m.linkProcessor.addStarTo(link, star.Stars)
		} else {
			m.linkProcessor.addStarTo(link, stars)

			star := Star{
				RepoUrl: repoUrl.String(),
				Stars:   stars,
			}
			err = m.db.Table(starCacheTable).Put(&star).Run()
			if err != nil {
				logrus.WithError(err).WithField("repo_url", repoUrl.String()).Error("unable to update stars")
			}
		}
	}

	// Create new markdown file
	tmpBuf := bytes.NewBuffer([]byte{})
	mdr := mdrender.NewRenderer()
	err := mdr.Render(tmpBuf, list.ReadmeBody, rootNode)
	if err != nil {
		return fmt.Errorf("failed to create updated markdown file, %s", err)
	}
	newUpdate := m.withAboutText(tmpBuf.Bytes(), rootNode, list.About)

	// get branch
	b, _, err := m.ghRestClient.Repositories.GetBranch(context.Background(), repoOwner, list.UploadRepoName, repoBranch)
	if err != nil {
		return fmt.Errorf("failed to get branch, %s", err)
	}

	// get last commit
	lastCommit, _, err := m.ghRestClient.Repositories.GetCommit(context.Background(), repoOwner, list.UploadRepoName, b.Commit.GetSHA())
	if err != nil {
		return fmt.Errorf("failed to get last commit, %s", err)
	}

	var lastCommitSha *string
	for _, f := range lastCommit.Files {
		if *f.Filename == repoReadmeFile {
			lastCommitSha = f.SHA
		}
	}

	// Upload awesome lists with star
	opts := &github.RepositoryContentFileOptions{
		Message: github.String(fmt.Sprintf("updated at: %s", time.Now().Format(time.RFC822))),
		Content: newUpdate,
		SHA:     lastCommitSha,
		Branch:  github.String(repoBranch),
		Committer: &github.CommitAuthor{
			Name:  github.String("awesome list creator"),
			Email: github.String("awesomelistcreator@example.com"),
		},
	}

	_, _, err = m.ghRestClient.Repositories.UpdateFile(context.Background(), repoOwner, list.UploadRepoName, repoReadmeFile, opts)
	if err != nil {
		return fmt.Errorf("failed to upload awesome list with stars, %s", err)
	}
	return nil
}
