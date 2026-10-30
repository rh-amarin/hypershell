//go:build js && wasm

// The browser build of hsctl, loaded by the web console terminal page.
//
// It runs inside the console tab and talks to the console's own origin. The
// console backend (BFF) adds the user's access token to every /api request
// from the session cookie, so the token never reaches the browser or this
// program.
//
// The program does not exit. It hands a run function to the page and then
// waits. Output goes to os.Stdout and os.Stderr, which the page captures.
package main

import (
	"fmt"
	"net/http"
	"os"
	"slices"
	"sync"
	"syscall/js"

	"github.com/openshift-online/hypershell/components/cli/pkg/config"
	"github.com/openshift-online/hypershell/components/cli/pkg/connection"
	"github.com/openshift-online/hypershell/components/cli/pkg/info"
)

// readyCallback is the global function the page defines before it starts the
// program. The program calls it once with { run, version }.
const readyCallback = "hypershellHsctlReady"

// sessionToken fills Config.AccessToken so the commands see a logged-in
// configuration. It is never sent: sessionClient removes the Authorization
// header, and the BFF adds the real token.
const sessionToken = "console-session"

// browserUnsupported lists commands that manage local credentials or local
// files. The console session replaces all of them.
var browserUnsupported = []string{"completion", "config", "login", "logout", "whoami"}

// runMu makes commands run one at a time, because they share flag state.
var runMu sync.Mutex

func main() {
	origin := js.Global().Get("location").Get("origin").String()
	config.SetStore(&memoryStore{cfg: config.Config{URL: origin, AccessToken: sessionToken}})
	connection.SetHTTPClientFactory(func(*config.Config) connection.HTTPClient {
		return sessionClient{client: &http.Client{}}
	})
	for _, command := range slices.Clone(root.Commands()) {
		if slices.Contains(browserUnsupported, command.Name()) {
			root.RemoveCommand(command)
		}
	}

	ready := js.Global().Get(readyCallback)
	if ready.Type() != js.TypeFunction {
		fmt.Fprintf(os.Stderr, "Error: the page did not define %s\n", readyCallback)
		return
	}
	ready.Invoke(map[string]any{
		"run":     js.FuncOf(run),
		"version": info.Version,
	})
	select {}
}

// run takes an array of arguments and returns a promise of the exit code.
func run(_ js.Value, args []js.Value) any {
	argv := []string{}
	if len(args) > 0 && args[0].Type() == js.TypeObject {
		for i := range args[0].Length() {
			argv = append(argv, args[0].Index(i).String())
		}
	}
	executor := js.FuncOf(func(_ js.Value, callbacks []js.Value) any {
		resolve := callbacks[0]
		// Commands make HTTP requests, which wait on the browser event loop,
		// so they must run outside this callback.
		go func() {
			resolve.Invoke(execute(argv))
		}()
		return nil
	})
	defer executor.Release()
	return js.Global().Get("Promise").New(executor)
}

func execute(argv []string) (code int) {
	runMu.Lock()
	defer runMu.Unlock()
	defer func() {
		for _, err := range resetFlags(root) {
			fmt.Fprintf(os.Stderr, "Warning: %s\n", err)
		}
	}()
	// A panic would stop the whole program and leave the terminal dead, so
	// report it as a failed command instead.
	defer func() {
		if recovered := recover(); recovered != nil {
			fmt.Fprintf(os.Stderr, "Error: internal error: %v\n", recovered)
			code = 2
		}
	}()

	root.SetArgs(argv)
	if err := root.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %s\n", err)
		return 1
	}
	return 0
}

// memoryStore keeps the configuration for the life of the page.
type memoryStore struct {
	mu  sync.Mutex
	cfg config.Config
}

func (s *memoryStore) Load() (*config.Config, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg := s.cfg
	return &cfg, nil
}

func (s *memoryStore) Save(cfg *config.Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cfg = *cfg
	return nil
}

// sessionClient sends requests with the browser's fetch, which carries the
// console session cookie to the same origin.
type sessionClient struct {
	client *http.Client
}

func (c sessionClient) Do(req *http.Request) (*http.Response, error) {
	req.Header.Del("Authorization")
	req.Header.Del("User-Agent")
	return c.client.Do(req)
}
