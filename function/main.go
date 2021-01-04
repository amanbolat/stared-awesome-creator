package main

import (
	"context"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/guregu/dynamo"
	"github.com/sirupsen/logrus"
	"net/http"
	"os"
	"stared-awesome-creator/awesome"
	"stared-awesome-creator/star"
	"time"
)

func handler(_ context.Context, _ events.CloudWatchEvent)  {
	githubToken := os.Getenv("GITHUB_TOKEN")
	if githubToken == "" {
		logrus.Fatal("GITHUB_TOKEN is not provided")
	}
	// Download awesome lists
	downloader := awesome.NewDownloader(&http.Client{Timeout: time.Second * 30})

	sess, err := session.NewSession()
	if err != nil {
		logrus.Fatal(err)
	}

	db := dynamo.New(sess, &aws.Config{Region: aws.String("us-west-2")})

	// Process awesome lists
	awesomeLists := downloader.DownloadLists()
	for list := range awesomeLists {
		logrus.WithField("list_name", list.Name).Info("parsing started")

		m := star.NewManager(githubToken, db)
		err := m.StarList(&list)
		if err != nil {
			logrus.WithError(err).WithField("list_name", list.Name).Error("failed to start list")
		} else {
			logrus.WithField("list_name", list.Name).Info("successfully updated awesome list with stars")
		}
	}
}

func main() {
	lambda.Start(handler)
}
