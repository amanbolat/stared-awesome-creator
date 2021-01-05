package star

import (
	"bytes"
	"context"
	"fmt"
	"github.com/guregu/dynamo"
	"github.com/sirupsen/logrus"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
	"golang.org/x/oauth2"
	"net/url"
	"stared-awesome-creator/awesome"
	"stared-awesome-creator/git"
	"stared-awesome-creator/markdown"
	"time"
)

const repoOwner = "amanbolat"
const defaultRepoBranch = "main"
const repoReadmeFile = "README.md"
const starCacheTable = "awesome_list_stars"

// Manager is responsible for whole process of updating awesome lists
// with stars.
type Manager struct {
	db            *dynamo.DB
	gitClient     *git.Client
}

func NewManager(githubToken string, db *dynamo.DB) *Manager {
	tokenSource := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: githubToken},
	)
	httpClient := oauth2.NewClient(context.Background(), tokenSource)
	httpClient.Timeout = time.Second * 15
	m := Manager{
		db:            db,
		gitClient:     git.NewClient(githubToken),
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

func (m *Manager) getLinksStarMap(links map[ast.Node]*url.URL) map[ast.Node]int {
	res := make(map[ast.Node]int)

	for link, repoUrl := range links {
		stars, err := m.gitClient.GetStarsCountFor(repoUrl)
		if err != nil {
			logrus.WithError(err).WithField("repo_url", repoUrl.String()).Error("unable to get stars from github api")
			var star Star
			err = m.db.Table(starCacheTable).Get("repo_url", repoUrl.String()).One(&star)
			if err != nil {
				logrus.WithError(err).WithField("repo_url", repoUrl.String()).Error("unable to get stars from cache")
			} else {
				stars = star.Stars
			}
		} else {
			star := Star{
				RepoUrl: repoUrl.String(),
				Stars:   stars,
			}
			err = m.db.Table(starCacheTable).Put(&star).Run()
			if err != nil {
				logrus.WithError(err).WithField("repo_url", repoUrl.String()).Error("unable to update stars")
			}
		}
		if stars >= 0 {
			res[link] = stars
		}
	}

	return res
}

func (m *Manager) StarList(list *awesome.AwesomeList) error {
	// parse file
	mdTextReader := text.NewReader(list.ReadmeBody)
	rootNode := goldmark.DefaultParser().Parse(mdTextReader)
	m.removeUnusedParts(list, rootNode)

	// add stars to links
	links := make(map[ast.Node]*url.URL)
	markdown.FindLinks(list.ReadmeBody, rootNode, links)
	logrus.WithField("list_name", list.Name).WithField("links_found", len(links)).Info("parsed links")

	linkStarMap := m.getLinksStarMap(links)
	for link, stars := range linkStarMap {
		markdown.StarLink(link, stars)
	}

	// sort links by star
	lists := make(chan *ast.List, 1)
	go func() {
		markdown.FindLists(list.ReadmeBody, rootNode, lists)
		close(lists)
	}()
	var listArr []*ast.List
	for list := range lists {
		listArr = append(listArr, list)
	}

	for _, list := range listArr {
		markdown.SortListItemsByStar(list)
	}

	// Create new markdown file
	tmpBuf := bytes.NewBuffer([]byte{})
	mdr := markdown.NewRenderer()
	err := mdr.Render(tmpBuf, list.ReadmeBody, rootNode)
	if err != nil {
		return fmt.Errorf("failed to create updated markdown file, %s", err)
	}
	newUpdate := m.withAboutText(tmpBuf.Bytes(), rootNode, list.About)

	// update repo
	repo := git.Repo{
		Owner: repoOwner,
		Name:  list.RepoToUpload,
	}
	err = m.gitClient.UpdateFile(repo, defaultRepoBranch, repoReadmeFile, newUpdate)
	if err != nil {
		return err
	}

	return nil
}
