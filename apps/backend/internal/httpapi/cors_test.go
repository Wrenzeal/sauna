package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSMiddlewareAllowsConfiguredOrigin(t *testing.T) {
	router := NewRouter(Services{}, RouterOptions{
		CORSAllowOrigins: []string{"https://sauna.wrenzeal.top"},
	})
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/public/agents", nil)
	request.Header.Set("Origin", "https://sauna.wrenzeal.top")
	request.Header.Set("Access-Control-Request-Method", http.MethodGet)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("expected 204 preflight, got %d", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "https://sauna.wrenzeal.top" {
		t.Fatalf("expected configured allow origin, got %q", got)
	}
	if got := response.Header().Get("Access-Control-Allow-Headers"); got == "" {
		t.Fatal("expected allowed headers")
	}
}

func TestCORSMiddlewareRejectsUnknownPreflightOrigin(t *testing.T) {
	router := NewRouter(Services{}, RouterOptions{
		CORSAllowOrigins: []string{"https://sauna.wrenzeal.top"},
	})
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/public/agents", nil)
	request.Header.Set("Origin", "https://evil.example")
	request.Header.Set("Access-Control-Request-Method", http.MethodGet)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403 preflight, got %d", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no allow origin, got %q", got)
	}
}
