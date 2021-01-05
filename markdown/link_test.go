package markdown_test

import (
	"bytes"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
	"net/url"
	"stared-awesome-creator/markdown"
	"testing"
)

func TestStarLink(t *testing.T) {
	input := []byte(`List of links:

* [link1](https://github.com/owner1/repo) - link 1 text
* [link2](https://github.com/owner2/repo) - link 2 text
* [link3](https://github.com/owner3/repo) - link 3 text
`)

	output := `List of links:

* <code>&nbsp;&nbsp;&nbsp;&nbsp;10</code> [link1](https://github.com/owner1/repo) - link 1 text
* <code>&nbsp;&nbsp;&nbsp;&nbsp;10</code> [link2](https://github.com/owner2/repo) - link 2 text
* <code>&nbsp;&nbsp;&nbsp;&nbsp;10</code> [link3](https://github.com/owner3/repo) - link 3 text
`

	mdTextReader := text.NewReader(input)
	rootNode := goldmark.DefaultParser().Parse(mdTextReader)

	linksMap := make(map[ast.Node]*url.URL)
	markdown.FindLinks(input, rootNode, linksMap)

	for link := range linksMap {
		markdown.StarLink(link, 10)
	}

	res := bytes.NewBuffer([]byte{})
	mdr := markdown.NewRenderer()
	err := mdr.Render(res, input, rootNode)
	require.NoError(t, err)
	assert.EqualValues(t, output, res.String())
}

func TestSortListItemsByStar(t *testing.T) {
	input := []byte(`List of links:

* [link1](https://github.com/owner1/repo) - link 1
* [link2](https://github.com/owner2/repo) - link 2
* [link3](https://github.com/owner3/repo) - link 3
* [link4](https://github.com/owner4/repo) - link 4
* [link5](https://github.com/owner5/repo) - link 5

`)

	mdTextReader := text.NewReader(input)
	rootNode := goldmark.DefaultParser().Parse(mdTextReader)

	linksMap := make(map[ast.Node]*url.URL)
	markdown.FindLinks(input, rootNode, linksMap)

	stars := 10
	for link := range linksMap {
		stars += 10
		markdown.StarLink(link, stars)
	}

	lists := make(chan *ast.List, 1)
	go func() {
		markdown.FindLists(input, rootNode, lists)
		close(lists)
	}()
	var listArr []*ast.List
	for list := range lists {
		listArr = append(listArr, list)
	}

	for _, list := range listArr {
		markdown.SortListItemsByStar(list)
	}

	res := bytes.NewBuffer(nil)
	mdr := markdown.NewRenderer()
	err := mdr.Render(res, input, rootNode)
	require.NoError(t, err)
}