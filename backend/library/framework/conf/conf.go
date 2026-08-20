package conf

import (
	"os"
	"time"

	"github.com/spf13/viper"

	_ "github.com/spf13/viper/remote"
)

type Configuration interface {
	Load() error
	Scan() error
	Watch() error
}

// todo
type Conf struct {
	viper *viper.Viper
}

func New() *viper.Viper {
	v := viper.New()

	v.AutomaticEnv()

	os.Setenv("PORT", "8080")

	v.AddRemoteProvider("etcd3", "http://127.0.0.1:4001", "/config/hugo.yml")
	v.SetConfigType("yaml")

	err := v.ReadRemoteConfig()
	if err != nil {
		panic(err)
	}

	go func() {
		for {
			time.Sleep(time.Second * 5) // delay after each request

			err := v.WatchRemoteConfig()
			if err != nil {

				continue
			}
		}
	}()

	return v
}
