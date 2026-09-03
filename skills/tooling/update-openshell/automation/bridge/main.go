// Command gwbridge is a loopback TLS-terminating bridge that lets openshell's
// gRPC (HTTP/2) gateway client work from inside an OpenShell sandbox.
//
// Why this exists: the sandbox egress supervisor is an L7 MITM proxy that pins
// ALPN to http/1.1, so gRPC (which requires h2) cannot traverse it. The sandbox
// policy must therefore mark the gateway endpoint `tls: skip` (raw TLS
// passthrough to the real gateway pod, which does offer h2). But openshell's
// gRPC client also (a) ignores HTTPS_PROXY and dials directly, and the sandbox
// cannot resolve the gateway host, and (b) if pointed at a loopback address it
// would send SNI=127.0.0.1, which the upstream ALB (SNI-routed) cannot route.
//
// gwbridge solves both: openshell connects to it over TLS on loopback (with
// OPENSHELL_GATEWAY_INSECURE=true so its throwaway cert is accepted); the bridge
// terminates that TLS, dials the CONNECT proxy, tunnels to <target>, and opens a
// fresh upstream TLS session with the correct SNI and ALPN=h2, then splices the
// two decrypted byte streams. gRPC frames ride through opaquely.
//
// Config via env:
//
//	BRIDGE_LISTEN  loopback listen address        (default 127.0.0.1:18443)
//	BRIDGE_TARGET  real gateway host:port         (required, e.g. gw-...:443)
//	BRIDGE_PROXY   CONNECT proxy host:port        (default 10.200.0.1:3128)
//	BRIDGE_READY   optional path; file written when the listener is up
package main

import (
	"bufio"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"fmt"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"sync"
	"time"
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// selfSignedCert generates an in-memory throwaway cert. openshell skips
// verification (OPENSHELL_GATEWAY_INSECURE=true), so its contents don't matter.
func selfSignedCert() (tls.Certificate, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	tmpl := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "gwbridge.local"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
		DNSNames:     []string{"localhost", "gwbridge.local"},
		IPAddresses:  []net.IP{net.IPv4(127, 0, 0, 1)},
	}
	der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, err
	}
	return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}, nil
}

// dialUpstream opens a CONNECT tunnel through the proxy to target, then starts a
// TLS session over it with the correct SNI and ALPN=h2.
func dialUpstream(proxy, target string) (net.Conn, error) {
	raw, err := net.DialTimeout("tcp", proxy, 15*time.Second)
	if err != nil {
		return nil, fmt.Errorf("dial proxy %s: %w", proxy, err)
	}
	req := fmt.Sprintf("CONNECT %s HTTP/1.1\r\nHost: %s\r\n\r\n", target, target)
	if _, err := raw.Write([]byte(req)); err != nil {
		raw.Close()
		return nil, fmt.Errorf("write CONNECT: %w", err)
	}
	br := bufio.NewReader(raw)
	resp, err := http.ReadResponse(br, &http.Request{Method: "CONNECT"})
	if err != nil {
		raw.Close()
		return nil, fmt.Errorf("read CONNECT response: %w", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw.Close()
		return nil, fmt.Errorf("CONNECT failed: %s", resp.Status)
	}
	if n := br.Buffered(); n > 0 {
		raw.Close()
		return nil, fmt.Errorf("proxy sent %d unexpected bytes after CONNECT", n)
	}
	host, _, err := net.SplitHostPort(target)
	if err != nil {
		host = target
	}
	tconn := tls.Client(raw, &tls.Config{
		ServerName:         host, // correct SNI for ALB routing
		NextProtos:         []string{"h2"},
		InsecureSkipVerify: true, // gateway pod uses openshell-ca; we don't pin
	})
	tconn.SetDeadline(time.Now().Add(15 * time.Second))
	if err := tconn.Handshake(); err != nil {
		tconn.Close()
		return nil, fmt.Errorf("upstream TLS handshake: %w", err)
	}
	tconn.SetDeadline(time.Time{})
	return tconn, nil
}

// splice copies in both directions and returns when both halves are done.
func splice(a, b net.Conn) {
	var wg sync.WaitGroup
	wg.Add(2)
	cp := func(dst, src net.Conn) {
		defer wg.Done()
		io.Copy(dst, src)
		// Signal EOF to the peer so its read unblocks and the pair tears down.
		if cw, ok := dst.(interface{ CloseWrite() error }); ok {
			cw.CloseWrite()
		} else {
			dst.Close()
		}
	}
	go cp(a, b)
	go cp(b, a)
	wg.Wait()
	a.Close()
	b.Close()
}

func handle(client net.Conn, proxy, target string) {
	defer client.Close()
	up, err := dialUpstream(proxy, target)
	if err != nil {
		log.Printf("upstream error: %v", err)
		return
	}
	splice(client, up)
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	listen := env("BRIDGE_LISTEN", "127.0.0.1:18443")
	target := env("BRIDGE_TARGET", "")
	proxy := env("BRIDGE_PROXY", "10.200.0.1:3128")
	ready := os.Getenv("BRIDGE_READY")
	if target == "" {
		log.Fatal("BRIDGE_TARGET is required (e.g. gw-host:443)")
	}

	cert, err := selfSignedCert()
	if err != nil {
		log.Fatalf("generate cert: %v", err)
	}
	tlsCfg := &tls.Config{
		Certificates: []tls.Certificate{cert},
		NextProtos:   []string{"h2", "http/1.1"},
		MinVersion:   tls.VersionTLS12,
	}
	ln, err := tls.Listen("tcp", listen, tlsCfg)
	if err != nil {
		log.Fatalf("listen %s: %v", listen, err)
	}
	log.Printf("gwbridge listening on %s -> %s via %s", listen, target, proxy)
	if ready != "" {
		if err := os.WriteFile(ready, []byte("ready\n"), 0o600); err != nil {
			log.Printf("warning: could not write ready file %s: %v", ready, err)
		}
	}
	for {
		conn, err := ln.Accept()
		if err != nil {
			log.Printf("accept error: %v", err)
			continue
		}
		go handle(conn, proxy, target)
	}
}
