package framework

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"sync"

	"github.com/qhai-dev/kairo/backend/library/framework/conf"
	"github.com/spf13/viper"
	"google.golang.org/grpc"
)

type App struct {
	opts options

	gs   *grpc.Server
	rs   *http.Server
	conf *viper.Viper

	startHooks    []func()
	shutdownHooks []func()

	mu sync.Mutex
}

func New(opts ...Option) *App {
	o := options{
		ctx:     context.Background(),
		version: "v1.0.0",
	}

	for _, opt := range opts {
		opt(&o)
	}

	app := &App{
		opts: o,
	}

	app.conf = conf.New()

	// 初始化 conf
	// 初始化 logger
	// 初始化 rpc / rest

	return app
}

func (app *App) Run() {
	fmt.Printf("app name %s \n", app.conf.Get("PORT"))
	initiallize()
}

func (app *App) RegisterStartHooks(hook func()) {
	app.startHooks = append(app.startHooks, hook)
}

func (app *App) RegisterShutdownHooks(hook func()) {
	app.shutdownHooks = append(app.shutdownHooks, hook)
}

func (app *App) Shutdown(ctx context.Context) error {
	err := app.runShutdownHooks()
	if err != nil {
		return err
	}

	return nil
}

func (app *App) runStartHooks() error {
	for _, hook := range app.startHooks {
		hook()
	}

	return nil
}

func (app *App) runShutdownHooks() error {
	for _, hook := range app.shutdownHooks {
		hook()
	}
	return nil
}

func env[T any](key string, def T) T {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return any(v).(T)
}

func initiallize() {

}
