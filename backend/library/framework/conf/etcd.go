package conf

import (
	clientv3 "go.etcd.io/etcd/client/v3"
)

func NewClient() *clientv3.Client {
	client, err := clientv3.New(clientv3.Config{
		Endpoints: []string{"127.0.0.1:33"},
	})

	if err != nil {
		panic(err)
	}

	return client
}
