package framework

import (
	"context"
	"net/http"
	"sync"

	"github.com/spf13/viper"
	"google.golang.org/grpc"
)

type App struct {
	opts options

	gs   *grpc.Server
	rs   *http.Server
	conf *viper.Viper

	mu sync.Mutex
}

func New(opts ...Option) *App {
	o := options{
		ctx: context.Background(),
	}

	for _, opt := range opts {
		opt(&o)
	}

	app := &App{
		opts: o,
	}

	return app
}

func (app *App) Run() int {
	return 1
}

func (app *App) Shutdown(ctx context.Context) error {
	return nil
}
