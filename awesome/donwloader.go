package awesome

import (
	"context"
	"io"
	"net/http"
	"sync"

	"github.com/sirupsen/logrus"
)

type Downloader struct {
	httpClient *http.Client
}

func NewDownloader(c *http.Client) *Downloader {
	return &Downloader{httpClient: c}
}

func (d *Downloader) DownloadLists(ctx context.Context) <-chan AwesomeList {
	downloadedLists := make(chan AwesomeList, 5)
	wg := &sync.WaitGroup{}

	for _, list := range awesomeLists {
		wg.Add(1)
		go func(list AwesomeList, wg *sync.WaitGroup, resChan chan AwesomeList) {
			defer wg.Done()
			logrus.WithField("list_name", list.Name).Info("download started")
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, list.ReadmeURL, nil)
			if err != nil {
				logrus.WithError(err).WithField("list_name", list.Name).Error("failed to create request")
				return
			}

			res, err := d.httpClient.Do(req)
			if err != nil {
				logrus.WithField("list_name", list.Name).WithError(err).Error("failed to download")
				return
			}

			b, err := io.ReadAll(res.Body)
			if err != nil {
				logrus.WithField("list_name", list.Name).WithError(err).Error("failed to read body")
				return
			}

			err = res.Body.Close()
			if err != nil {
				logrus.Error(err)
				return
			}

			resChan <- AwesomeList{
				Name:              list.Name,
				ReadmeURL:         list.ReadmeURL,
				RepoToUpload:      list.RepoToUpload,
				ReadmeBody:        b,
				About:             list.About,
				RemoveUnusedParts: list.RemoveUnusedParts,
			}
		}(list, wg, downloadedLists)
	}

	go func() {
		wg.Wait()
		close(downloadedLists)
	}()

	return downloadedLists
}
