package datapol

import (
	"fmt"
	"reflect"
	"strings"
)

func Verify[T any](value T) []string {
	defer func() {
		if r := recover(); r != nil {
			//TODO maybe export a metric
			// klog.Warningf("Error while inspecting arguments for sensitive data: %v", r)
		}
	}()
	t := reflect.ValueOf(value)
	if t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	return datatypes(t)
}

func datatypes(v reflect.Value) []string {
	if types := byType(v.Type()); len(types) > 0 {
		switch v.Kind() {
		case reflect.Slice, reflect.Map:
			if !v.IsZero() && v.Len() > 0 {
				return types
			}
		default:
			if !v.IsZero() {
				return types
			}
		}
	}
	switch v.Kind() {
	case reflect.Interface:
		return datatypes(v.Elem())
	case reflect.Slice, reflect.Array:
		for i := 0; i < v.Len(); i++ {
			if types := datatypes(v.Index(i)); len(types) > 0 {
				return types
			}
		}
	case reflect.Map:
		mapIter := v.MapRange()
		for mapIter.Next() {
			k := mapIter.Key()
			v := mapIter.Value()
			if types := datatypes(k); len(types) > 0 {
				return types
			}
			if types := datatypes(v); len(types) > 0 {
				return types
			}
		}
	case reflect.Struct:
		t := v.Type()
		for i := range t.NumField() {
			f := t.Field(i)
			if f.Type.Kind() == reflect.Pointer {
				continue
			}
			if reason, ok := f.Tag.Lookup("datapolicy"); ok {
				if !v.Field(i).IsZero() {
					fmt.Print(reason, "2")
					return strings.Split(reason, ",")
				}
			}
			if types := datatypes(v.Field(i)); len(types) > 0 {
				return types
			}
		}
	}
	return nil
}
