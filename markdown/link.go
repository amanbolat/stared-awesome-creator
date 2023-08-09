package markdown

import (
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/yuin/goldmark/ast"
)

const StarCountAttributeName = "stars"
const githubHostName = "github.com"

type link struct {
	Node ast.Node
	Url  *url.URL
}

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

	// Set attribute to the list item for later sorting
	// ONLY if the links is the first in the line
	if !IsFirstLinkInLine(link) {
		return
	}

	parent := link.Parent()
	for parent != nil {
		if parent.Kind() == ast.KindListItem {
			parent.SetAttributeString(StarCountAttributeName, star)
			break
		}
		parent = parent.Parent()
	}
}

// IsFirstLinkInLine returns true if the link is the first
// among all siblings
func IsFirstLinkInLine(link ast.Node) bool {
	isFirst := true
	prev := link.PreviousSibling()
	for prev != nil {
		if prev.Kind() == ast.KindLink {
			isFirst = false
		}
		prev = prev.PreviousSibling()
	}

	return isFirst
}

func SortListItemsByStar(list *ast.List) {
	children := GetChildren(list)
	list.RemoveChildren(list)

	type kv struct {
		Key   ast.Node
		Value int
	}

	var childMap []kv
	for _, child := range children {
		val, ok := child.AttributeString(StarCountAttributeName)
		if ok {
			childMap = append(childMap, kv{child, val.(int)})
		} else {
			childMap = append(childMap, kv{child, -1})
		}
	}

	sort.Slice(childMap, func(i, j int) bool {
		return childMap[i].Value > childMap[j].Value
	})

	for i, child := range childMap {
		if i == 0 {
			child.Key.SetBlankPreviousLines(true)
		} else {
			child.Key.SetBlankPreviousLines(false)
		}
		list.AppendChild(list, child.Key)
	}
}

// FindLinks finds and returns all the links from Markdown node
func FindLinks(buf []byte, node ast.Node, links map[ast.Node]*url.URL) {
	if node.Kind() == ast.KindLink {
		astLink := node.(*ast.Link)
		l, ok := GetRepoValidLink(astLink)
		if ok {
			links[l.Node] = l.Url
		}
	}

	if node.HasChildren() {
		next := node.FirstChild()
		for next != nil {
			FindLinks(buf, next, links)
			next = next.NextSibling()
		}
	}
}

func GetRepoValidLink(astLink *ast.Link) (*link, bool) {
	if astLink == nil {
		return nil, false
	}

	dest := string(astLink.Destination)
	u, err := url.Parse(dest)
	if err != nil {
		return nil, false
	}

	if u.Hostname() != githubHostName {
		return nil, false
	}

	l := &link{
		Node: astLink,
		Url:  u,
	}

	return l, true
}

// FindLists sends all the ast.List from the node to lists chan
func FindLists(buf []byte, node ast.Node, lists chan *ast.List) {
	if node.Kind() == ast.KindList {
		astList := node.(*ast.List)
		lists <- astList
	}

	if node.HasChildren() {
		next := node.FirstChild()
		for next != nil {
			FindLists(buf, next, lists)
			next = next.NextSibling()
		}
	}
}

func GetChildren(node ast.Node) []ast.Node {
	c := node.FirstChild()
	var arr []ast.Node
	for c != nil {
		arr = append(arr, c)
		c = c.NextSibling()
	}

	return arr
}
