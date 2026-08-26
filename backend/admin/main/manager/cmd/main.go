package main

import (
	"os"

	"github.com/qhai-dev/yato/backend/library/framework"
)

func main() {
	app := framework.New(
		framework.Name("admin.main.manager"),
		framework.Version("v1.0.0"),
	)

	os.Exit(app.Run())
}
