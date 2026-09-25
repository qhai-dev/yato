//go:build wireinject
// +build wireinject

package main

import (
	"github.com/google/wire"
)

func initializeApp() {
	panic(wire.Build())
}
