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
All repositories are still sorted alphabetically.

## Why?
Some of the viewers might be against this idea because "stars don't mean anything" or "stars != code quality".
Yet stars are about numbers, and numbers talk for themselves. First of all, stars may help some newcomers who 
are not familiar with %%programming_language%% ecosystem and want to find some good framework for the first project. 
This list will help them to find a few popular web-frameworks, libraries or tools for a quick start. Secondly, people like me 
might often use a such list of projects to find something trending or they just want to find similar libraries to 
run benchmarks.

## How?
This repository is updated every %%interval%% by the script which is/will be run by scheduler. 
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
