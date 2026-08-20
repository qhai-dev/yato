package framework

import "context"

type Option func(*options)

type options struct {
	ctx     context.Context
	name    string
	version string
	// env     Environment
	// etcdServers []string
	// etcdEndpoint string
}

// type Environment struct {
// 	Port         int
// 	EtcdEndpoint string
// }

// func EnvironmentLoader(env Environment) Option {
// 	return func(o *options) {
// 		o.env = env
// 	}
// }

func Name(name string) Option {
	return func(o *options) {
		o.name = name
	}
}

func Version(version string) Option {
	return func(o *options) {
		o.version = version
	}
}
