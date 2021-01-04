package star

import (
	"github.com/yuin/goldmark/ast"
	"net/url"
)

type Link struct {
	Node ast.Node
	Url *url.URL
}
