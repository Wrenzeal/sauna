package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestListModelsParsesOpenAICompatibleResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer sk-test" {
			t.Fatalf("unexpected auth header %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"object":"list","data":[{"id":"gpt-a","object":"model","created":1,"owned_by":"org"},{"id":""},{"id":"embed-b"}]}`))
	}))
	defer server.Close()

	client := NewOpenAICompatibleClient()
	models, err := client.ListModels(context.Background(), server.URL+"/v1/", "sk-test")
	if err != nil {
		t.Fatalf("ListModels: %v", err)
	}
	if len(models) != 2 {
		t.Fatalf("expected 2 non-empty models, got %d", len(models))
	}
	if models[0].ID != "gpt-a" || models[0].OwnedBy != "org" || models[1].ID != "embed-b" {
		t.Fatalf("unexpected models %#v", models)
	}
}

func TestTestChatAggregatesStreamDeltasAndUsage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"o\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"k\"}}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":1,\"total_tokens\":4}}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	client := NewOpenAICompatibleClient()
	result, err := client.TestChat(context.Background(), ChatRequest{BaseURL: server.URL + "/v1", APIKey: "sk-test", Model: "gpt-test", Messages: []Message{{Role: "user", Content: "ping"}}})
	if err != nil {
		t.Fatalf("TestChat: %v", err)
	}
	if !result.OK || result.Content != "ok" {
		t.Fatalf("unexpected result %#v", result)
	}
	if result.Usage.PromptTokens != 3 || result.Usage.CompletionTokens != 1 || result.Usage.TotalTokens != 4 {
		t.Fatalf("unexpected usage %#v", result.Usage)
	}
}

func TestListModelsReportsNonJSONProviderResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<!doctype html><html><body>gateway login page</body></html>`))
	}))
	defer server.Close()

	client := NewOpenAICompatibleClient()
	_, err := client.ListModels(context.Background(), server.URL+"/v1", "sk-test")
	if err == nil {
		t.Fatal("expected non-json provider response error")
	}
	message := err.Error()
	if !strings.Contains(message, "OpenAI 兼容的 JSON 模型列表") {
		t.Fatalf("expected helpful compatibility message, got %q", message)
	}
	if strings.Contains(message, "invalid character") {
		t.Fatalf("raw json decoder error leaked: %q", message)
	}
}

func TestListModelsReportsEmptyModelList(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"object":"list","data":[{"id":""}]}`))
	}))
	defer server.Close()

	client := NewOpenAICompatibleClient()
	_, err := client.ListModels(context.Background(), server.URL+"/v1", "sk-test")
	if err == nil {
		t.Fatal("expected empty model list error")
	}
	if !strings.Contains(err.Error(), "没有可用模型") {
		t.Fatalf("unexpected error %q", err.Error())
	}
}

func TestStreamChatFallsBackToChunkedJSONResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if payload["stream"] != true {
			t.Fatalf("expected stream=true request, got %#v", payload)
		}
		if _, exists := payload["stream_options"]; exists {
			t.Fatalf("stream_options should not be sent by default")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz中文测试"}}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`))
	}))
	defer server.Close()

	client := NewOpenAICompatibleClient()
	var chunks []string
	usage, err := client.StreamChat(context.Background(), ChatRequest{BaseURL: server.URL + "/v1", APIKey: "sk-test", Model: "gpt-test", Messages: []Message{{Role: "user", Content: "ping"}}}, func(delta string) error {
		chunks = append(chunks, delta)
		return nil
	})
	if err != nil {
		t.Fatalf("StreamChat: %v", err)
	}
	if len(chunks) < 2 {
		t.Fatalf("expected JSON fallback to split oversized content, got %#v", chunks)
	}
	if got := strings.Join(chunks, ""); got != "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz中文测试" {
		t.Fatalf("unexpected chunk join %q", got)
	}
	if usage.TotalTokens != 5 {
		t.Fatalf("unexpected usage %#v", usage)
	}
}

func TestSplitChunksPreservesUnicode(t *testing.T) {
	chunks := splitChunks("中文测试abcdef", 3)
	if strings.Join(chunks, "") != "中文测试abcdef" {
		t.Fatalf("unicode chunks did not rejoin: %#v", chunks)
	}
	if chunks[0] != "中文测" {
		t.Fatalf("expected rune based chunking, got %#v", chunks)
	}
}
