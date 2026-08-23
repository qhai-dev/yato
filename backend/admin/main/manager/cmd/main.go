package main

import (
	"fmt"

	"github.com/qhai-dev/yato/backend/apis/admin/main/manager/v1"
)

func main() {
	//app := framework.New(
	//	framework.Name("admin.main.manager"),
	//	framework.Version("v1.0.0"),
	//)
	//code := app.Run()
	//os.Exit(code)

	user := manager.User{
		Id:       1,
		NickName: "yato",
	}

	fmt.Printf("%+v", &user)
}
