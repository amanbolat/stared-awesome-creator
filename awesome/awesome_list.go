package awesome

import (
	"github.com/yuin/goldmark/ast"
)

type ModifyMarkdownFunc func(buf []byte, node ast.Node)

type AwesomeList struct {
	Name string
	// ReadmeURL is the link to awesome list's raw
	// readme file
	ReadmeURL string
	// RepoToUpload is my repo to upload links
	// awesome list file
	RepoToUpload      string
	ReadmeBody        []byte
	About             string
	RemoveUnusedParts ModifyMarkdownFunc
}

var awesomeLists = []AwesomeList{
	{
		Name:         "Awesome Go",
		ReadmeURL:    "https://raw.githubusercontent.com/avelino/awesome-go/master/README.md",
		RepoToUpload: "awesome-go-with-stars",
		About: `
# About
This repository is a clone of [Awesome Go](https://github.com/avelino/awesome-go) but with stars.
All repositories are sorted by star count. Stars are updated every day automatically.
`,
		RemoveUnusedParts: func(b []byte, rootNode ast.Node) {
			var toRemove []ast.Node
			next := rootNode.FirstChild()
			for {
				if next.Kind() == ast.KindHeading && string(next.Text(b)) == "Contents" {
					break
				}
				toRemove = append(toRemove, next)
				next = next.NextSibling()
			}

			for _, node := range toRemove {
				rootNode.RemoveChild(rootNode, node)
			}
		},
	},
}
