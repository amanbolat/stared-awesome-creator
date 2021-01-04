package star

import (
	"context"
	"errors"
	"fmt"
	"github.com/shurcooL/githubv4"
	"github.com/sirupsen/logrus"
	"github.com/yuin/goldmark/ast"
	"net/url"
	"strings"
)

const githubHostName = "github.com"

// LinkProcessor fetches stars StargazerCount of the repo by link
// and updates link's AST node
type LinkProcessor struct {
	// links is a map with link nodes which were parsed
	links        map[*ast.Link]bool
	// linkUrlMap map with link node and its repo url
	linkUrlMap   map[*ast.Link]*url.URL
	githubClient *githubv4.Client
}

func NewLinkProcessor(gitClient *githubv4.Client) *LinkProcessor {
	return &LinkProcessor{
		links:        map[*ast.Link]bool{},
		linkUrlMap:   map[*ast.Link]*url.URL{},
		githubClient: gitClient,
	}
}

// SaveLink saves link to links map for further manipulations
func (lp *LinkProcessor) SaveLink(link *ast.Link) {
	if link == nil {
		return
	}

	if _, ok := lp.links[link]; ok {
		return
	}

	lp.links[link] = true

	dest := string(link.Destination)
	u, err := url.Parse(dest)
	if err != nil {
		logrus.Error(err)
		return
	}

	if u.Hostname() != githubHostName {
		return
	}

	lp.linkUrlMap[link] = u
}

// addStarTo alters link node and adds star as a text ot its content
func (lp *LinkProcessor) addStarTo(link *ast.Link, star int) {
	if star < 1 {
		return
	}

	textBlock := link.Parent()
	starTxtNode := ast.NewText()
	starTxt := strings.Replace(fmt.Sprintf("<code>%6d</code>", star), " ", "&nbsp;", -1)
	starTxtNode.AppendChild(starTxtNode, ast.NewString([]byte(starTxt)))

	textBlock.InsertBefore(textBlock, link, starTxtNode)
	textBlock.InsertAfter(textBlock, starTxtNode, ast.NewString([]byte(" ")))
}

// getStarCountFor returns count of stars for repoUrl
func (lp *LinkProcessor) getStarCountFor(repoUrl *url.URL) (int, error) {
	owner, name := repoFromPath(repoUrl)
	if owner == "" || name == "" {
		return 0, errors.New("unable retrieve owner and name")
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

	err := lp.githubClient.Query(context.Background(), &q, args)
	if err != nil {
		return 0, fmt.Errorf("unable fetch repo stars, %s", err)
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
