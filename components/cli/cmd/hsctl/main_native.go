//go:build !js

package main

import (
	"fmt"
	"os"

	tuicmd "github.com/openshift-online/hypershell/components/cli/cmd/hsctl/tui"
)

func init() {
	// The terminal UI needs a real terminal, so only the native build has it.
	root.AddCommand(tuicmd.Cmd)
}

func main() {
	root.SetArgs(os.Args[1:])
	err := root.Execute()
	if err == nil {
		os.Exit(0)
	}

	fmt.Fprintf(os.Stderr, "Error: %s\n", err)
	os.Exit(1)
}
