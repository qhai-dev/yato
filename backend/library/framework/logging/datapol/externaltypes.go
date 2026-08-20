package datapol

import (
	"crypto/x509"
	"net/http"
	"reflect"
)

var (
	httpHeader      = reflect.TypeOf(http.Header{})
	httpCookie      = reflect.TypeOf(http.Cookie{})
	x509Certificate = reflect.TypeOf(x509.Certificate{})
)

// GlobalDatapolicyMapping returns the list of sensitive datatypes are embedded
// in types not native to Kubernetes.
func GlobalDatapolicyMapping(v interface{}) []string {
	return byType(reflect.TypeOf(v))
}

func byType(t reflect.Type) []string {
	switch t {
	case httpHeader:
		return []string{"password", "token"}
	case httpCookie:
		return []string{"token"}
	case x509Certificate:
		return []string{"security-key"}
	default:
		return nil
	}
}
