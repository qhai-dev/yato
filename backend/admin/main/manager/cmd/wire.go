//go:build wireinject
// +build wireinject

package main

import (
	"github.com/google/wire"

	"github.com/qhai-dev/yato/backend/admin/main/manager/internal/api"
	"github.com/qhai-dev/yato/backend/admin/main/manager/internal/app"
	"github.com/qhai-dev/yato/backend/admin/main/manager/internal/infra"
)

func initializeApp() {
	panic(wire.Build(
		infra.ProviderSet,
		app.ProviderSet,
		api.ProviderSet,
	))
}
