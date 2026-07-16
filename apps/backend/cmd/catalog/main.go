package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"sauna/backend/internal/catalogpkg"
	"sauna/backend/internal/config"
	"sauna/backend/internal/postgres"
	"time"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: catalog validate|import --dir <path> [--request-id <uuid>]")
	}
	command := os.Args[1]
	flags := flag.NewFlagSet(command, flag.ExitOnError)
	dir := flags.String("dir", "", "skill package directory")
	requestID := flags.String("request-id", "", "catalog request id")
	_ = flags.Parse(os.Args[2:])
	pkg, err := catalogpkg.Load(*dir)
	if err != nil {
		log.Fatal(err)
	}
	if command == "validate" {
		fmt.Printf("valid catalog package: %s (%s)\n", pkg.Manifest.DisplayName, pkg.ContentHash)
		return
	}
	if command != "import" {
		log.Fatalf("unknown command %q", command)
	}
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	agentID, version, created, err := catalogpkg.Import(ctx, pool, pkg, *requestID)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("catalog import complete: agent=%s version=%d new_version=%t\n", agentID, version, created)
}
