package main

import (
	"reflect"
	"testing"

	"github.com/spf13/cobra"
)

func TestResetFlagsRestoresDefaultsBetweenRuns(t *testing.T) {
	var output string
	var labels []string
	var size int
	parent := &cobra.Command{Use: "parent"}
	child := &cobra.Command{Use: "child", RunE: func(*cobra.Command, []string) error { return nil }}
	child.Flags().StringVarP(&output, "output", "o", "table", "")
	child.Flags().StringSliceVar(&labels, "label", []string{"a"}, "")
	child.Flags().IntVar(&size, "size", 100, "")
	parent.AddCommand(child)

	parent.SetArgs([]string{"child", "-o", "json", "--label", "x,y", "--size", "5"})
	if err := parent.Execute(); err != nil {
		t.Fatalf("first run: %v", err)
	}
	if output != "json" || size != 5 || !reflect.DeepEqual(labels, []string{"x", "y"}) {
		t.Fatalf("flags not applied: output=%q size=%d labels=%v", output, size, labels)
	}

	if errs := resetFlags(parent); len(errs) != 0 {
		t.Fatalf("reset errors: %v", errs)
	}
	if output != "table" || size != 100 || !reflect.DeepEqual(labels, []string{"a"}) {
		t.Fatalf("flags not reset: output=%q size=%d labels=%v", output, size, labels)
	}
	if child.Flags().Lookup("output").Changed {
		t.Fatal("output flag still marked as changed")
	}

	// A second run without flags must see the defaults.
	parent.SetArgs([]string{"child"})
	if err := parent.Execute(); err != nil {
		t.Fatalf("second run: %v", err)
	}
	if output != "table" {
		t.Fatalf("second run saw stale output %q", output)
	}
}

func TestSliceDefault(t *testing.T) {
	cases := map[string][]string{
		"[]":    {},
		"[a]":   {"a"},
		"[a,b]": {"a", "b"},
	}
	for in, want := range cases {
		if got := sliceDefault(in); !reflect.DeepEqual(got, want) {
			t.Errorf("sliceDefault(%q) = %v, want %v", in, got, want)
		}
	}
}
