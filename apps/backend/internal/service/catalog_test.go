package service

import "testing"

func TestIsAdminEmailNormalizesExactAllowlist(t *testing.T) {
	admins := []string{" Owner@Example.com "}
	if !IsAdminEmail("owner@example.com", admins) {
		t.Fatal("expected exact normalized email to be admin")
	}
	if IsAdminEmail("owner+other@example.com", admins) {
		t.Fatal("unexpected alias to be admin")
	}
}

func TestNormalizeCatalogName(t *testing.T) {
	if got := NormalizeCatalogName(" Steve-Jobs  "); got != "stevejobs" {
		t.Fatalf("got %q", got)
	}
	if got := NormalizeCatalogName("稻盛 和夫"); got != "稻盛和夫" {
		t.Fatalf("got %q", got)
	}
}
