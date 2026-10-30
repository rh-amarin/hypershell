package main

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

// resetFlags puts every flag of cmd and its subcommands back to its default.
//
// The commands are package-level values, so a flag set by one run stays set
// for the next run in the same process. The native CLI runs once per process
// and never needs this. The browser build runs many commands in one process,
// so it calls this after each command.
func resetFlags(cmd *cobra.Command) []error {
	var errs []error
	reset := func(flag *pflag.Flag) {
		if !flag.Changed {
			return
		}
		var err error
		if slice, ok := flag.Value.(pflag.SliceValue); ok {
			err = slice.Replace(sliceDefault(flag.DefValue))
		} else {
			err = flag.Value.Set(flag.DefValue)
		}
		if err != nil {
			errs = append(errs, fmt.Errorf("can't reset flag --%s of '%s': %w", flag.Name, cmd.CommandPath(), err))
			return
		}
		flag.Changed = false
	}
	cmd.Flags().VisitAll(reset)
	cmd.PersistentFlags().VisitAll(reset)
	for _, child := range cmd.Commands() {
		errs = append(errs, resetFlags(child)...)
	}
	return errs
}

// sliceDefault turns the printed default of a slice flag, such as "[a,b]" or
// "[]", back into its values.
func sliceDefault(value string) []string {
	value = strings.TrimSuffix(strings.TrimPrefix(value, "["), "]")
	if value == "" {
		return []string{}
	}
	return strings.Split(value, ",")
}
