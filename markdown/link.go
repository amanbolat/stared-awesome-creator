package markdown

import (
	"fmt"
	"github.com/yuin/goldmark/ast"
	"strings"
)

// StarLink alters link node and adds star as a text ot its content
func StarLink(link ast.Node, star int) {
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