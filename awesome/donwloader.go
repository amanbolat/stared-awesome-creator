package awesome

import (
	"github.com/sirupsen/logrus"
	"io/ioutil"
	"net/http"
	"sync"
)

type Downloader struct {
	httpClient *http.Client
}

func NewDownloader(c *http.Client) *Downloader {
	return &Downloader{httpClient: c}
}

func (d *Downloader) DownloadLists() <-chan AwesomeList {
	downloadedLists := make(chan AwesomeList, 5)
	var wg sync.WaitGroup

	for _, list := range awesomeLists {
		wg.Add(1)
		go func(list AwesomeList, wg *sync.WaitGroup, resChan chan AwesomeList) {
			logrus.WithField("list_name", list.Name).Info("download started")
			res, err := d.httpClient.Get(list.ReadmeURL)
			if err != nil {
				logrus.WithField("list_name", list.Name).WithError(err).Error("failed to download")
				wg.Done()
			}

			b, err := ioutil.ReadAll(res.Body)
			if err != nil {
				logrus.WithField("list_name", list.Name).WithError(err).Error("failed to read body")
				wg.Done()
			}

			err = res.Body.Close()
			if err != nil {
				logrus.Error(err)
				wg.Done()
			}

			resChan <- AwesomeList{
				Name:           list.Name,
				ReadmeURL:      list.ReadmeURL,
				UploadRepoName: list.UploadRepoName,
				ReadmeBody:     b,
				About:          list.About,
				RemoveUnusedParts: list.RemoveUnusedParts,
			}
			wg.Done()
		}(list, &wg, downloadedLists)
	}

	go func() {
		wg.Wait()
		close(downloadedLists)
	}()

	return downloadedLists
}