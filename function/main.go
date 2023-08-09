package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"stared-awesome-creator/awesome"
	"stared-awesome-creator/star"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/guregu/dynamo"
	"github.com/sirupsen/logrus"
)

func run(ctx context.Context) {
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
	awesomeLists := downloader.DownloadLists(ctx)
	for list := range awesomeLists {
		logrus.WithField("list_name", list.Name).Info("parsing started")

		m := star.NewManager(githubToken, db)
		err := m.StarList(ctx, &list)
		if err != nil {
			logrus.WithError(err).WithField("list_name", list.Name).Error("failed to start list")
		} else {
			logrus.WithField("list_name", list.Name).Info("successfully updated awesome list with stars")
		}
	}
}

func handler(ctx context.Context, _ events.CloudWatchEvent) {
	run(ctx)
}

func main() {
	lambdaEnv := os.Getenv("AWS_LAMBDA_FUNCTION_NAME")

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, os.Kill)
	defer stop()

	if lambdaEnv == "" {
		run(ctx)
	} else {
		lambda.Start(handler)
	}
}
